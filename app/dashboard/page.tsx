import { redirect } from "next/navigation";

/**
 * Rota raiz do dashboard.
 *
 * O dashboard usa a aba "Orçamentos" como página inicial. Antes esta rota
 * mostrava um card intermediário de boas-vindas com botões de navegação, o que
 * obrigava um clique extra e duplicava a navegação que já existe no
 * DashboardHeader. Agora redireciona direto para a lista de orçamentos.
 */
export default function DashboardPage() {
  redirect("/dashboard/orcamentos");
}
