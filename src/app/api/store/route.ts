import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { serverClient } from "@/lib/supabase-server";
import { applyCommand } from "@/lib/domain";
import type { Store, Command } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function authorize(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token)
    throw new ApiError("Entre com uma conta autorizada para continuar.", 401);
  const client = serverClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user)
    throw new ApiError("Sua sessão expirou. Entre novamente.", 401);
  return { client, uid: data.user.id };
}
type Snapshot = { store: Store; revision: number; name: string };
async function snapshot(
  client: ReturnType<typeof serverClient>,
  uid: string,
): Promise<Snapshot> {
  const { data, error } = await client.rpc("bitstock_snapshot", { p_uid: uid });
  if (error) {
    if (error.message.includes("NOT_AUTHORIZED"))
      throw new ApiError("Esta conta não tem acesso à loja.", 403);
    throw error;
  }
  return data as Snapshot;
}
function responseError(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json(
      { error: "Solicitação inválida." },
      { status: 400 },
    );
  console.error(
    "bitStock API:",
    error instanceof Error ? error.message : "Falha na persistência",
  );
  return NextResponse.json(
    {
      error:
        "Não foi possível acessar os dados da loja. Tente novamente ou confira a configuração.",
    },
    { status: 503 },
  );
}
export async function GET(req: NextRequest) {
  try {
    const { client, uid } = await authorize(req);
    const { store, name } = await snapshot(client, uid);
    return NextResponse.json(
      { store, name },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return responseError(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    const { client, uid } = await authorize(req);
    const raw = await req.text();
    if (raw.length > 16000)
      throw new ApiError("Solicitação muito grande.", 413);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new ApiError("Solicitação inválida.", 400);
    const { command, operationId } = body as {
      command: Command;
      operationId: string;
    };
    if (
      typeof operationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        operationId,
      )
    )
      throw new ApiError("Identificador de operação inválido.", 400);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ uid, command }))
      .digest("hex");
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = await snapshot(client, uid);
      // Requisições já concluídas são verificadas antes de reaplicar o comando.
      const { data: receipt, error: receiptError } = await client
        .from("operation_receipts")
        .select("fingerprint")
        .eq("id", operationId)
        .maybeSingle();
      if (receiptError) throw receiptError;
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new ApiError(
            "Identificador já utilizado em outra operação.",
            409,
          );
        const latest = await snapshot(client, uid);
        return NextResponse.json(
          { store: latest.store },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      let next: Store;
      try {
        next = applyCommand(
          current.store,
          command,
          current.name,
          new Date().toISOString(),
          operationId,
        );
      } catch (error) {
        throw new ApiError(
          error instanceof Error ? error.message : "Dados inválidos.",
          400,
        );
      }
      const { data, error } = await client.rpc("bitstock_commit", {
        p_uid: uid,
        p_operation: operationId,
        p_fingerprint: fingerprint,
        p_revision: current.revision,
        p_store: next,
      });
      if (error) {
        if (error.message.includes("NOT_AUTHORIZED"))
          throw new ApiError("Esta conta não tem acesso à loja.", 403);
        if (error.message.includes("OPERATION_CONFLICT"))
          throw new ApiError(
            "Identificador já utilizado em outra operação.",
            409,
          );
        throw error;
      }
      if (data === "retry") continue;
      const latest = await snapshot(client, uid);
      return NextResponse.json(
        { store: latest.store },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    throw new ApiError(
      "O estoque foi atualizado por outro usuário. Tente novamente.",
      409,
    );
  } catch (error) {
    return responseError(error);
  }
}
