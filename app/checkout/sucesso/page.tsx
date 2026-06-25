import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata = { title: "Pagamento recebido" };

type Props = { searchParams: { status?: string } };

/**
 * Página de retorno após o checkout (back_url success/pending do Mercado Pago).
 * O provisionamento real da conta acontece no webhook — aqui só confirmamos
 * ao cliente que o pagamento foi recebido e que o acesso chega por e-mail.
 */
export default function CheckoutSucessoPage({ searchParams }: Props) {
  const pendente = searchParams.status === "pending";

  return (
    <main className="grid min-h-screen place-items-center bg-[#0A0A0A] px-5 text-[#EDEDED]">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-400/15">
          <CheckCircle2 className="size-8 text-emerald-400" />
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          {pendente ? "Pagamento em processamento" : "Pagamento recebido!"}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-white/55">
          {pendente
            ? "Assim que o Mercado Pago confirmar o pagamento, criaremos sua conta e enviaremos o link de acesso por e-mail."
            : "Estamos preparando sua conta. Em instantes você receberá um e-mail com o link para definir sua senha e acessar o painel."}
        </p>

        <p className="mt-2 text-xs text-white/35">
          Não recebeu? Verifique a caixa de spam.
        </p>

        <Link
          href="/login"
          className="mt-8 inline-block rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
        >
          Ir para o login
        </Link>
      </div>
    </main>
  );
}
