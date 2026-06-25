import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { TenantForm } from "@/components/tenant-form";
import type { Tenant, Assinatura } from "@/lib/types";

export const dynamic = "force-dynamic";

const FORMA_LABEL: Record<string, string> = {
  mercado_pago: "Mercado Pago",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
};

const PLANO_LABEL: Record<string, string> = {
  basico: "Básico",
  pro: "Pro",
  manual: "Manual",
};

function formatarDataHora(iso: string): string {
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleString("pt-BR");
}

function formatarValor(valor: number | null): string {
  if (valor == null) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(valor);
}

export default async function EditarTenantPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabase();

  const [{ data }, { data: historico }] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("assinaturas")
      .select("*")
      .eq("tenant_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!data) notFound();
  const tenant = data as Tenant;
  const pagamentos = (historico ?? []) as Assinatura[];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/admin"
        className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
      >
        ← Assinantes
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
        {tenant.nome_empresa}
      </h1>
      <p className="mt-1 mb-8 text-sm text-gray-500">
        Editar dados do tenant.
      </p>

      <TenantForm tenant={tenant} />

      {/* ------------------------- Histórico de pagamentos ------------------- */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold text-gray-900">
          Histórico de pagamentos
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          {pagamentos.length} registro{pagamentos.length === 1 ? "" : "s"} na
          tabela <code className="font-mono">assinaturas</code>.
        </p>

        {pagamentos.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-500">
            Nenhum pagamento registrado para este tenant.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Plano</th>
                  <th className="px-5 py-3 font-medium">Valor</th>
                  <th className="px-5 py-3 font-medium">Forma</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagamentos.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 text-gray-600">
                      {formatarDataHora(p.created_at)}
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {PLANO_LABEL[p.plano] ?? p.plano}
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {formatarValor(p.valor)}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {FORMA_LABEL[p.forma_pagamento] ?? p.forma_pagamento}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          p.status === "approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {p.status === "approved" ? "Aprovado" : p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
