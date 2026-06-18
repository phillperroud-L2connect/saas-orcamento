import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import LogoutButton from "./logout-button";

export default async function DashboardPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Não escrevemos cookies neste Server Component (read-only).
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nome =
    (user?.user_metadata?.nome as string | undefined) ?? user?.email ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          Bem-vindo{nome ? `, ${nome}` : ""}!
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Você está autenticado no Gerador de Orçamento.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/orcamentos"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Orçamentos
          </Link>
          <Link
            href="/dashboard/financeiro"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Financeiro
          </Link>
        </div>
        <div className="mt-3">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
