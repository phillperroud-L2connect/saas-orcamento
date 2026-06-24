import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import LogoutButton from "./logout-button";
import { getTenantI18n } from "@/lib/i18n-server";

export default async function DashboardPage() {
  const { dict } = await getTenantI18n();

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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-800 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {dict.home.bemVindo(nome)}
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {dict.home.autenticado}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/orcamentos"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            {dict.nav.orcamentos}
          </Link>
          <Link
            href="/dashboard/financeiro"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {dict.nav.financeiro}
          </Link>
          <Link
            href="/dashboard/servicos"
            className="col-span-2 inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {dict.nav.servicos}
          </Link>
        </div>
        <div className="mt-3">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
