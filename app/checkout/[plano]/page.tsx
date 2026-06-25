import { notFound } from "next/navigation";
import Script from "next/script";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { getPlano } from "@/lib/planos";
import { CheckoutPanel } from "./checkout-panel";

/* Tipografia do design system L2 — escopada à página de checkout.
   (O layout global usa Geist; não o alteramos para não afetar o app.) */
const l2Sans = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-l2-sans",
  display: "swap",
});
const l2Mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-l2-mono",
  display: "swap",
});

export const dynamic = "force-dynamic";

type Props = { params: { plano: string } };

export function generateMetadata({ params }: Props) {
  const plano = getPlano(params.plano);
  return {
    title: plano ? `Contratar plano ${plano.nome}` : "Checkout",
  };
}

/**
 * Página pública de checkout (sem login). Segue o design system L2
 * (azul elétrico #3ea6ff, Space Grotesk + JetBrains Mono, atmosfera escura).
 * Mostra o resumo do plano com toggle mensal/anual e o formulário que cria a
 * preferência de pagamento no Mercado Pago.
 */
export default function CheckoutPage({ params }: Props) {
  const plano = getPlano(params.plano);
  if (!plano) notFound();

  return (
    <main
      className={`${l2Sans.variable} ${l2Mono.variable} relative min-h-screen bg-[#05070d] text-[#e8edf7]`}
      style={{ fontFamily: "var(--font-l2-sans), system-ui, sans-serif" }}
    >
      {/* SDK do Mercado Pago — necessário para o Wallet Brick (botão de pagar). */}
      <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" />

      {/* Atmosfera de fundo — glow azul/ciano do design system L2. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(60rem 60rem at 85% -10%, rgba(62,166,255,0.14), transparent 60%), radial-gradient(50rem 50rem at -10% 110%, rgba(110,224,255,0.10), transparent 55%)",
        }}
      />
      {/* Linha de luz superior — assinatura visual do L2. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(62,166,255,0.45) 12%, rgba(200,240,255,0.9) 38%, rgba(255,255,255,1) 50%, rgba(200,240,255,0.9) 62%, rgba(62,166,255,0.45) 88%, transparent 100%)",
        }}
      />

      <CheckoutPanel
        plano={plano}
        publicKey={process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? ""}
      />
    </main>
  );
}
