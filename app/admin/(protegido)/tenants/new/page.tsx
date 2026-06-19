import Link from "next/link";
import { TenantForm } from "@/components/tenant-form";

export default function NovoTenantPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/admin"
        className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
      >
        ← Tenants
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
        Novo tenant
      </h1>
      <p className="mt-1 mb-8 text-sm text-gray-500">
        Cadastre uma nova empresa no SaaS.
      </p>

      <TenantForm />
    </main>
  );
}
