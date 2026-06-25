import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase-server";
import { TenantRow } from "@/components/admin/tenant-row";
import type { Tenant } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createServerSupabase();

  // Tenants + histórico de pagamentos (assinaturas) para contar por tenant.
  const [{ data, error }, { data: assinaturas }] = await Promise.all([
    supabase.from("tenants").select("*").order("created_at", { ascending: false }),
    supabase.from("assinaturas").select("tenant_id"),
  ]);

  const tenants = (data ?? []) as Tenant[];

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

      {!error && tenants.length === 0 && (
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

      {tenants.length > 0 && (
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
