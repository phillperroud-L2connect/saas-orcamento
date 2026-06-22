import Link from "next/link";
import { DashboardNav } from "@/components/dashboard-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import LogoutButton from "./logout-button";

/**
 * Layout compartilhado das páginas do dashboard.
 * Fornece o header com navegação, o botão de tema (claro/escuro) e o logout.
 * O tema é aplicado globalmente via classe `.dark` no <html> (ver layout raiz).
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/dashboard"
            className="text-sm font-bold tracking-tight text-gray-900 dark:text-gray-100"
          >
            Orçamentos
          </Link>

          <div className="hidden md:block">
            <DashboardNav />
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>

        {/* Navegação em telas pequenas */}
        <div className="border-t border-gray-100 px-4 py-2 dark:border-gray-800 md:hidden">
          <DashboardNav />
        </div>
      </header>

      {children}
    </div>
  );
}
