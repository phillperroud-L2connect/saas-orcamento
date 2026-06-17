import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";

export const metadata = {
  title: "Painel Admin — Gerador de Orçamento",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Camada de servidor: só o e-mail admin passa. Qualquer outro usuário
  // autenticado é mandado de volta ao dashboard.
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/admin" className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-tight text-gray-900">
              Painel Admin
            </span>
            <span className="text-xs font-medium uppercase tracking-widest text-gray-400">
              Tenants
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            ← Voltar ao app
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
