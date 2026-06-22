import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ServicosManager } from "@/components/servicos-manager";

export const metadata = {
  title: "Meus Serviços | Gerador de Orçamento",
};

export default function ServicosPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 transition hover:text-gray-900"
        >
          <ArrowLeft className="size-4" />
          Voltar ao painel
        </Link>
      </div>
      <ServicosManager />
    </main>
  );
}
