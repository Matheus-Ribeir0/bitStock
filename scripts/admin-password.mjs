import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const email = process.argv[2];
if (!email || !process.stdin.isTTY) {
  console.error(
    "Execute em um terminal: npm run admin:password -- seu@email.com",
  );
  process.exit(1);
}

function secret(prompt) {
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    function finish(error) {
      process.stdin.off("data", input);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }
    function input(chunk) {
      for (const char of chunk) {
        if (char === "\u0003") return finish(new Error("Cancelado."));
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u007f" || char === "\b")
          value = [...value].slice(0, -1).join("");
        else if (char >= " ") value += char;
      }
    }
    process.stdin.on("data", input);
  });
}

try {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  let user;
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    user = data.users.find((item) => item.email === email);
    if (user || data.users.length < 100) break;
  }
  if (!user)
    throw new Error("Conta não encontrada. Provisione a conta primeiro.");
  const { data: staff, error } = await client
    .from("staff")
    .select("authorized")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!staff?.authorized) throw new Error("Conta sem autorização para a loja.");
  const password = await secret("Nova senha (mínimo 12 caracteres, oculta): ");
  const confirmation = await secret("Confirme a senha (oculta): ");
  if (password.length < 12) throw new Error("Use pelo menos 12 caracteres.");
  if (password !== confirmation) throw new Error("As senhas não coincidem.");
  const result = await client.auth.admin.updateUserById(user.id, { password });
  if (result.error) throw result.error;
  // Confirma o login real sem imprimir ou salvar a senha ou a sessão.
  const publicClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const login = await publicClient.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  await publicClient.auth.signOut({ scope: "local" });
  console.log(
    "Senha definida e login verificado. Você já pode entrar no bitStock.",
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Não foi possível definir a senha.",
  );
  process.exitCode = 1;
}
