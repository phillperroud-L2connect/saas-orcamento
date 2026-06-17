import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { TenantForm } from "@/components/tenant-form";
import type { Tenant } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditarTenantPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const tenant = data as Tenant;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/admin"
        className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
      >
        ← Tenants
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
        {tenant.nome_empresa}
      </h1>
      <p className="mt-1 mb-8 text-sm text-gray-500">
        Editar dados do tenant.
      </p>

      <TenantForm tenant={tenant} />
    </main>
  );
}
