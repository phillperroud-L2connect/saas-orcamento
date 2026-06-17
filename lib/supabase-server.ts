import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Cliente Supabase para Server Components (read-only).
 * Lê a sessão a partir dos cookies da requisição. Não escreve cookies —
 * a revalidação/refresh da sessão é responsabilidade do middleware.
 */
export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Read-only nos Server Components.
        },
      },
    },
  );
}
