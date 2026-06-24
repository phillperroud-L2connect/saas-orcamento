import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ServicosManager } from "@/components/servicos-manager";
import { getTenantI18n } from "@/lib/i18n-server";

export const metadata = {
  title: "Meus Serviços | Gerador de Orçamento",
};

export default async function ServicosPage() {
  const { dict } = await getTenantI18n();
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 transition hover:text-gray-900"
        >
          <ArrowLeft className="size-4" />
          {dict.common.voltarPainel}
        </Link>
      </div>
      <ServicosManager />
    </main>
  );
}
