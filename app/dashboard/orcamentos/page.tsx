import { OrcamentosManager } from "@/components/orcamentos-manager";

export const metadata = {
  title: "Orçamentos | Gerador de Orçamento",
};

export default function OrcamentosPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <OrcamentosManager />
    </main>
  );
}
