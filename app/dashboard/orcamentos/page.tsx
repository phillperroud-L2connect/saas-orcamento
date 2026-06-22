import { OrcamentosManager } from "@/components/orcamentos-manager";
import { OrcamentosLista } from "@/components/orcamentos-lista";

export const metadata = {
  title: "Orçamentos | Gerador de Orçamento",
};

export default function OrcamentosPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <OrcamentosManager />
      <OrcamentosLista />
    </main>
  );
}
