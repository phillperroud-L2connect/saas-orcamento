import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ConfiguracoesForm } from "@/components/configuracoes-form";

export const metadata = {
  title: "Configurações | Gerador de Orçamento",
};

/**
 * Página de configurações do tenant.
 *
 * Também é o redirect_uri do OAuth do Mercado Pago: quando o prestador volta da
 * autorização, o MP acrescenta ?code=...&state=tenant_id. Como esta rota é
 * protegida, o usuário logado passa pelo middleware (rotas públicas reenviariam
 * a query). A troca do código é delegada server-side a /api/mp/oauth (sem
 * cookies → sem bounce) e a URL é limpa para ?mp=ok|erro.
 */
export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: { code?: string; state?: string; mp?: string };
}) {
  const code = searchParams.code;
  const state = searchParams.state;

  if (code && state) {
    const h = headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    const origin = `${proto}://${host}`;

    let mp = "erro";
    try {
      const res = await fetch(`${origin}/api/mp/oauth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state }),
        cache: "no-store",
      });
      if (res.ok) mp = "ok";
    } catch (err) {
      console.error("[configuracoes] erro ao trocar código MP:", err);
    }
    redirect(`/dashboard/configuracoes?mp=${mp}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ConfiguracoesForm />
    </main>
  );
}
