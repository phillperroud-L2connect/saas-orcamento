import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a SERVICE ROLE KEY — bypassa o RLS.
 *
 * Uso EXCLUSIVO no servidor (route handlers de webhook), nunca no browser:
 * a service role tem acesso total ao banco e à API de administração do Auth
 * (auth.admin.createUser, generateLink, etc.).
 *
 * Requer SUPABASE_SERVICE_ROLE_KEY no .env.local (a "secret key" do projeto,
 * em Settings → API do Supabase). Não confundir com a anon/publishable key.
 */
export function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service client indisponível: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
