"use client";

import Link from "next/link";
import { DashboardNav } from "@/components/dashboard-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n } from "@/components/i18n-provider";
import LogoutButton from "@/app/dashboard/logout-button";

/**
 * Header do dashboard (cliente) — usa o idioma do tenant para o nome do app,
 * a navegação e o botão de logout.
 */
export function DashboardHeader() {
  const { dict } = useI18n();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/dashboard"
          className="text-sm font-bold tracking-tight text-gray-900 dark:text-gray-100"
        >
          {dict.nav.orcamentos}
        </Link>

        <div className="hidden md:block">
          <DashboardNav />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>

      {/* Navegação em telas pequenas — faixa rolável na horizontal quando os
          itens não cabem em uma linha, sem forçar scroll na página inteira. */}
      <div className="no-scrollbar overflow-x-auto border-t border-gray-100 px-4 py-2 dark:border-gray-800 md:hidden">
        <DashboardNav />
      </div>
    </header>
  );
}
