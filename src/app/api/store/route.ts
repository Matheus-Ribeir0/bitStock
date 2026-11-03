import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { adminServices } from "@/lib/firebase-admin";
import { applyCommand } from "@/lib/domain";
import type { Store, Command } from "@/lib/types";
import type { Firestore, Transaction } from "firebase-admin/firestore";
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
  const services = adminServices();
  let identity;
  try {
    identity = await services.auth.verifyIdToken(token, true);
  } catch {
    throw new ApiError("Sua sessão expirou. Entre novamente.", 401);
  }
  const allowed = await services.db.doc(`users/${identity.uid}`).get();
  if (!allowed.exists || allowed.data()?.authorized !== true)
    throw new ApiError("Esta conta não tem acesso à loja.", 403);
  return {
    ...services,
    uid: identity.uid,
    name: String(
      allowed.data()?.name || identity.name || identity.email || "Colaborador",
    ),
  };
}
async function readStore(db: Firestore, tx: Transaction): Promise<Store> {
  const snapshots = await Promise.all(
    ["products", "movements", "serviceOrders"].map((name) =>
      tx.get(db.collection(name)),
    ),
  );
  return {
    products: snapshots[0].docs.map((d) => d.data()),
    movements: snapshots[1].docs.map((d) => d.data()),
    orders: snapshots[2].docs.map((d) => d.data()),
  } as Store;
}
function responseError(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json(
      { error: "Solicitação inválida." },
      { status: 400 },
    );
  console.error(
    "bitStock API:",
    error instanceof Error ? error.message : "Falha desconhecida",
  );
  return NextResponse.json(
    {
      error:
        "Não foi possível acessar os dados da loja. Confira a configuração e tente novamente.",
    },
    { status: 503 },
  );
}
export async function GET(req: NextRequest) {
  try {
    const { db, name } = await authorize(req);
    const store = await db.runTransaction((tx) => readStore(db, tx));
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
    const { db, uid, name } = await authorize(req);
    const raw = await req.text();
    if (raw.length > 16000)
      throw new ApiError("Solicitação muito grande.", 413);
    const { command, operationId } = JSON.parse(raw);
    if (
      typeof operationId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(operationId)
    )
      throw new ApiError("Identificador de operação inválido.", 400);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ uid, command }))
      .digest("hex");
    const now = new Date().toISOString();
    const store = await db.runTransaction(async (tx) => {
      const receipt = db.doc(`operations/${operationId}`);
      const revision = db.doc("settings/revision");
      const [previous, version] = await Promise.all([
        tx.get(receipt),
        tx.get(revision),
      ]);
      const current = await readStore(db, tx);
      if (previous.exists) {
        if (previous.data()?.fingerprint !== fingerprint)
          throw new ApiError(
            "Identificador já utilizado em outra operação.",
            409,
          );
        return current;
      }
      let next: Store;
      try {
        next = applyCommand(
          current,
          command as Command,
          name,
          now,
          operationId,
        );
      } catch (error) {
        throw new ApiError(
          error instanceof Error ? error.message : "Dados inválidos.",
          400,
        );
      }
      for (const [key, collection] of [
        ["products", "products"],
        ["movements", "movements"],
        ["orders", "serviceOrders"],
      ] as const) {
        const old = new Map(
          current[key].map((item) => [item.id, JSON.stringify(item)]),
        );
        for (const item of next[key])
          if (old.get(item.id) !== JSON.stringify(item))
            tx.set(db.doc(`${collection}/${item.id}`), item);
      }
      tx.set(revision, {
        version: Number(version.data()?.version || 0) + 1,
        updatedAt: now,
      });
      tx.set(receipt, { fingerprint, uid, createdAt: now });
      return next;
    });
    return NextResponse.json(
      { store },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return responseError(error);
  }
}
