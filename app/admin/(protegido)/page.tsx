import Link from "next/link";
import { Plus, Building2, Clock } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase-server";
import { TenantRow } from "@/components/admin/tenant-row";
import type { Tenant } from "@/lib/types";

export const dynamic = "force-dynamic";

const PLANO_LABEL: Record<string, string> = {
  basico: "Básico",
  pro: "Pro",
  manual: "Manual",
};

/** Venda paga cujo cadastro ainda não foi concluído (tenant não existe). */
type PendingSale = {
  id: string;
  email: string;
  nome: string | null;
  plano: string;
  created_at: string;
};

export default async function AdminPage() {
  const supabase = createServerSupabase();

  // Tenants + histórico (contagem) + vendas pagas SEM cadastro concluído
  // (tenant_id nulo) para que pagamentos aprovados não fiquem invisíveis.
  const [{ data, error }, { data: assinaturas }, { data: pendentesRaw }] =
    await Promise.all([
      supabase.from("tenants").select("*").order("created_at", { ascending: false }),
      supabase.from("assinaturas").select("tenant_id"),
      supabase
        .from("assinaturas")
        .select("id, email, nome, plano, created_at")
        .is("tenant_id", null)
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
    ]);

  const tenants = (data ?? []) as Tenant[];

  // Deduplica por e-mail (mantém a venda mais recente aguardando cadastro).
  const pendentes: PendingSale[] = [];
  const emailsVistos = new Set<string>();
  for (const p of (pendentesRaw ?? []) as PendingSale[]) {
    const chave = (p.email ?? "").toLowerCase();
    if (!chave || emailsVistos.has(chave)) continue;
    emailsVistos.add(chave);
    pendentes.push(p);
  }

  // Mapa tenant_id -> nº de pagamentos no histórico.
  const pagamentosPorTenant = new Map<string, number>();
  for (const a of assinaturas ?? []) {
    const id = (a as { tenant_id: string | null }).tenant_id;
    if (id) pagamentosPorTenant.set(id, (pagamentosPorTenant.get(id) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Assinantes
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {tenants.length} empresa{tenants.length === 1 ? "" : "s"} cadastrada
            {tenants.length === 1 ? "" : "s"} no SaaS.
            {pendentes.length > 0 &&
              ` · ${pendentes.length} pagamento${
                pendentes.length === 1 ? "" : "s"
              } aguardando cadastro.`}
          </p>
        </div>
        <Link
          href="/admin/tenants/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          <Plus className="size-4" />
          Novo tenant
        </Link>
      </div>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar tenants: {error.message}. Verifique se as migrações{" "}
          <code className="font-mono">supabase-admin.sql</code> e{" "}
          <code className="font-mono">supabase-tenant-ativo.sql</code> foram aplicadas.
        </p>
      )}

      {!error && tenants.length === 0 && pendentes.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <Building2 className="mx-auto size-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            Nenhum tenant cadastrado ainda.
          </p>
          <Link
            href="/admin/tenants/new"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-900 underline-offset-2 hover:underline"
          >
            <Plus className="size-4" />
            Criar o primeiro
          </Link>
        </div>
      )}

      {(tenants.length > 0 || pendentes.length > 0) && (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Empresa</th>
                <th className="px-5 py-3 font-medium">Plano</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Vencimento</th>
                <th className="px-5 py-3 font-medium">Pagamento</th>
                <th className="px-5 py-3 font-medium">Acesso</th>
                <th className="px-5 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Vendas pagas aguardando o cliente concluir o cadastro. */}
              {pendentes.map((p) => (
                <tr key={`pend-${p.id}`} className="bg-amber-50/40">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
                        <Clock className="size-4" />
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {p.nome || p.email}
                        </div>
                        <div className="text-xs text-gray-400">{p.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {PLANO_LABEL[p.plano] ?? p.plano}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      Pago — aguardando cadastro
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-400">—</td>
                  <td className="px-5 py-3.5 text-gray-600">Mercado Pago</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                      <span className="size-1.5 rounded-full bg-gray-400" />
                      Aguardando
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-xs text-gray-400">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
              {tenants.map((t) => (
                <TenantRow
                  key={t.id}
                  tenant={t}
                  pagamentos={pagamentosPorTenant.get(t.id) ?? 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
