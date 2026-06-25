import { notFound } from "next/navigation";
import Script from "next/script";
import { Check } from "lucide-react";
import { getPlano, formatarPrecoARS } from "@/lib/planos";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

type Props = { params: { plano: string } };

export function generateMetadata({ params }: Props) {
  const plano = getPlano(params.plano);
  return {
    title: plano ? `Contratar plano ${plano.nome}` : "Checkout",
  };
}

/**
 * Página pública de checkout (sem login). Mostra o resumo do plano e o
 * formulário que cria a preferência de pagamento no Mercado Pago.
 */
export default function CheckoutPage({ params }: Props) {
  const plano = getPlano(params.plano);
  if (!plano) notFound();

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#EDEDED]">
      {/* SDK do Mercado Pago — necessário para o Wallet Brick (botão de pagar). */}
      <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" />

      {/* Atmosfera de fundo */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60rem 60rem at 85% -10%, rgba(16,185,129,0.10), transparent 60%), radial-gradient(50rem 50rem at -10% 110%, rgba(99,102,241,0.10), transparent 55%)",
        }}
      />

      <div className="relative mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        {/* ----------------------------- Resumo do plano ---------------------- */}
        <section className="lg:pr-8">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-emerald-400/80">
            Checkout
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl">
            Plano
            <br />
            <span className="text-emerald-400">{plano.nome}</span>
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/55">
            {plano.descricao}
          </p>

          <div className="mt-10 flex items-end gap-2">
            <span className="text-5xl font-semibold tracking-tight">
              {formatarPrecoARS(plano.preco)}
            </span>
            <span className="mb-1.5 text-sm text-white/45">/ mês</span>
          </div>

          <ul className="mt-8 space-y-3">
            {plano.recursos.map((r) => (
              <li key={r} className="flex items-center gap-3 text-sm text-white/75">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-400/15">
                  <Check className="size-3 text-emerald-400" />
                </span>
                {r}
              </li>
            ))}
          </ul>
        </section>

        {/* ----------------------------- Formulário --------------------------- */}
        <section className="lg:pl-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm sm:p-8">
            <h2 className="text-lg font-semibold">Seus dados</h2>
            <p className="mt-1 text-sm text-white/45">
              Preencha para continuar ao pagamento seguro.
            </p>
            <CheckoutForm
              plano={plano.id}
              publicKey={process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? ""}
            />
          </div>
          <p className="mt-4 text-center text-xs text-white/35">
            Pagamento processado com segurança pelo Mercado Pago.
          </p>
        </section>
      </div>
    </main>
  );
}
