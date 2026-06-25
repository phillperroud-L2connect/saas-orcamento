import { redirect } from "next/navigation";
import { I18nProvider } from "@/components/i18n-provider";
import { DashboardHeader } from "@/components/dashboard-header";
import { createServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Layout compartilhado das páginas do dashboard.
 * Fornece o idioma do tenant (via I18nProvider), o header com navegação,
 * o botão de tema (claro/escuro) e o logout.
 * O tema é aplicado globalmente via classe `.dark` no <html> (ver layout raiz).
 *
 * Enforcement de acesso: se o tenant estiver suspenso (`ativo = false`),
 * redireciona para /conta-suspensa. A autenticação em si continua a cargo do
 * middleware.ts (não alterado) — aqui apenas checamos a flag do tenant.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .maybeSingle();

    const tenantId = userRow?.tenant_id as string | undefined;
    if (tenantId) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("ativo")
        .eq("id", tenantId)
        .maybeSingle();

      // Bloqueia o acesso apenas quando a suspensão é explícita (ativo === false).
      if (tenant && tenant.ativo === false) {
        redirect("/conta-suspensa");
      }
    }
  }

  return (
    <I18nProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <DashboardHeader />
        {children}
      </div>
    </I18nProvider>
  );
}
