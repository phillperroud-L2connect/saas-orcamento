import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase-server";
import type { Tenant } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAIS_LABEL: Record<string, string> = { BR: "🇧🇷 Brasil", AR: "🇦🇷 Argentina" };

export default async function AdminPage() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  const tenants = (data ?? []) as Tenant[];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Tenants
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
          Erro ao carregar tenants: {error.message}. Verifique se a migração{" "}
          <code className="font-mono">supabase-admin.sql</code> foi aplicada.
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
        <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Empresa</th>
                <th className="px-5 py-3 font-medium">Profissional</th>
                <th className="px-5 py-3 font-medium">País</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenants.map((t) => (
                <tr key={t.id} className="transition hover:bg-gray-50/70">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span
                        className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg text-xs font-bold text-white"
                        style={{ background: t.cor_primaria || "#0F0F0F" }}
                      >
                        {t.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.logo_url}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          t.nome_empresa.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {t.nome_empresa}
                        </div>
                        <div className="text-xs text-gray-400">{t.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {t.nome_profissional || "—"}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {PAIS_LABEL[t.pais] ?? t.pais}
                    {t.pais === "AR" && t.moeda_preferida && (
                      <span className="ml-1 text-xs text-gray-400">
                        ({t.moeda_preferida})
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        t.ativo
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          t.ativo ? "bg-emerald-500" : "bg-gray-400"
                        }`}
                      />
                      {t.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
