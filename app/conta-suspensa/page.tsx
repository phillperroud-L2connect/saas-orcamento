"use client";

import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Página de conta suspensa.
 *
 * Para onde o layout do dashboard redireciona quando o tenant está com
 * `ativo = false`. Não fica sob o layout do dashboard (evita loop de redirect)
 * e exige usuário autenticado (o middleware mantém o gate de auth — não foi
 * alterado). Aqui o cliente só pode sair da conta ou falar com o suporte.
 */
export default function ContaSuspensaPage() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-50 dark:bg-amber-950/40">
          <LockKeyhole className="size-6 text-amber-600 dark:text-amber-400" />
        </span>

        <h1 className="mt-5 text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Acesso suspenso
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          O acesso da sua conta está temporariamente bloqueado. Isso costuma
          acontecer por uma pendência na assinatura. Regularize o pagamento ou
          fale com o suporte para reativar o acesso.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
          El acceso a tu cuenta está temporalmente bloqueado. Regularizá el pago
          o contactá al soporte para reactivarlo.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <a
            href="mailto:phillperroud@gmail.com?subject=Reativar%20acesso%20-%20Gerador%20de%20Orçamento"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Falar com o suporte
          </a>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Sair da conta
          </button>
        </div>
      </div>
    </main>
  );
}
