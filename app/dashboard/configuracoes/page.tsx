import { ConfiguracoesForm } from "@/components/configuracoes-form";

export const metadata = {
  title: "Configurações | Gerador de Orçamento",
};

export default function ConfiguracoesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ConfiguracoesForm />
    </main>
  );
}
