"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";

export function DashboardNav() {
  const pathname = usePathname();
  const { dict } = useI18n();

  const links = [
    { href: "/dashboard/orcamentos", label: dict.nav.orcamentos },
    { href: "/dashboard/pagamentos", label: dict.nav.pagamentos },
    { href: "/dashboard/financeiro", label: dict.nav.financeiro },
    { href: "/dashboard/servicos", label: dict.nav.servicos },
    { href: "/dashboard/configuracoes", label: dict.nav.configuracoes },
  ];

  return (
    <nav className="flex items-center gap-1">
      {links.map((l) => {
        const ativo = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              ativo
                ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
