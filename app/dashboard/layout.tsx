import { I18nProvider } from "@/components/i18n-provider";
import { DashboardHeader } from "@/components/dashboard-header";

/**
 * Layout compartilhado das páginas do dashboard.
 * Fornece o idioma do tenant (via I18nProvider), o header com navegação,
 * o botão de tema (claro/escuro) e o logout.
 * O tema é aplicado globalmente via classe `.dark` no <html> (ver layout raiz).
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <I18nProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <DashboardHeader />
        {children}
      </div>
    </I18nProvider>
  );
}
