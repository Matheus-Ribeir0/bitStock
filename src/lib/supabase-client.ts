import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
let client: SupabaseClient | undefined;
export function clientAuth() {
  if (!supabaseConfigured)
    throw new Error("O acesso da loja ainda não foi configurado.");
  client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  return client.auth;
}
export async function accessToken() {
  const { data, error } = await clientAuth().getSession();
  if (error || !data.session)
    throw new Error("Sua sessão expirou. Entre novamente.");
  return data.session.access_token;
}
