import "server-only";
import { createClient } from "@supabase/supabase-js";
export function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SERVER_NOT_CONFIGURED");
  // Cliente exclusivo do servidor. Não compartilhar uma sessão de usuário aqui.
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
