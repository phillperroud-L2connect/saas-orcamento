import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para uso no browser (Client Components).
 * Lê as credenciais públicas de NEXT_PUBLIC_SUPABASE_URL e
 * NEXT_PUBLIC_SUPABASE_ANON_KEY definidas em .env.local.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
