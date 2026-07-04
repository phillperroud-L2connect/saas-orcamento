import { PagamentosManager } from "@/components/pagamentos-manager";

export const metadata = {
  title: "Pagamentos | Gerador de Orçamento",
};

export default function PagamentosPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <PagamentosManager />
    </main>
  );
}
