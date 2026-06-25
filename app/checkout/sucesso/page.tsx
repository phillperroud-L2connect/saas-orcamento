import Link from "next/link";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { CheckCircle2, Mail, Settings2, Smartphone, ArrowRight } from "lucide-react";
import InstalarAppButton from "./instalar-app-button";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-l2-sans",
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-l2-mono",
});

const LOGIN_URL = "https://orcamento-saas-phillbrar.vercel.app/login";

export const metadata = { title: "Pagamento confirmado" };

type Props = { searchParams: { status?: string } };

const PASSOS = [
  {
    icon: Mail,
    titulo: "Acesse seu e-mail",
    descricao: "Enviamos o link de acesso para definir sua senha.",
  },
  {
    icon: Settings2,
    titulo: "Faça o login e configure sua conta",
    descricao: "Personalize logo, cor e seus dados em poucos minutos.",
  },
  {
    icon: Smartphone,
    titulo: "Instale o app",
    descricao: "Tenha o gerador na tela inicial do celular ou do computador.",
  },
];

/**
 * Página de retorno após o checkout (back_url success/pending do Mercado Pago).
 * O provisionamento real da conta acontece no webhook — aqui confirmamos o
 * pagamento, orientamos os próximos passos e oferecemos a instalação do PWA.
 */
export default function CheckoutSucessoPage({ searchParams }: Props) {
  const pendente = searchParams.status === "pending";

  return (
    <main
      className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} relative grid min-h-screen place-items-center overflow-hidden px-5 py-16`}
      style={{
        background: "#05070d",
        color: "#e8edf7",
        fontFamily: "var(--font-l2-sans), system-ui, sans-serif",
      }}
    >
      {/* Atmosfera: glow radial azul atrás do conteúdo */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[520px] w-[520px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(62,166,255,0.22) 0%, rgba(62,166,255,0.06) 40%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />
      {/* Grade sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(62,166,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(62,166,255,0.025) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(circle at 50% 30%, black, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 30%, black, transparent 75%)",
        }}
      />

      <div className="relative w-full max-w-xl text-center">
        {/* Eyebrow */}
        <span
          className="inline-flex items-center gap-2.5 text-xs font-medium uppercase tracking-[0.18em]"
          style={{
            fontFamily: "var(--font-l2-mono), ui-monospace, monospace",
            color: "#6ee0ff",
          }}
        >
          <span
            aria-hidden
            className="h-px w-6"
            style={{ background: "#6ee0ff" }}
          />
          {pendente ? "Pagamento em análise" : "Pagamento aprovado"}
        </span>

        {/* Ícone de confirmação */}
        <div
          className="mx-auto mt-7 grid size-20 place-items-center rounded-full"
          style={{
            background: "rgba(74,222,128,0.10)",
            border: "1px solid rgba(74,222,128,0.30)",
            boxShadow: "0 0 40px rgba(74,222,128,0.20)",
          }}
        >
          <CheckCircle2 className="size-10" style={{ color: "#4ade80" }} />
        </div>

        {/* Título */}
        <h1 className="mt-7 text-[clamp(30px,5vw,46px)] font-medium leading-[1.05] tracking-[-0.02em]">
          {pendente ? (
            "Pagamento em processamento"
          ) : (
            <>
              Pagamento{" "}
              <span
                style={{
                  background:
                    "linear-gradient(100deg, #6ee0ff 0%, #3ea6ff 55%, #8a9bff 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                confirmado!
              </span>
            </>
          )}
        </h1>

        <p
          className="mx-auto mt-4 max-w-md text-sm leading-relaxed"
          style={{ color: "#aab4c8" }}
        >
          {pendente
            ? "Assim que o Mercado Pago confirmar o pagamento, criaremos sua conta e enviaremos o link de acesso por e-mail. Siga os passos abaixo para começar."
            : "Estamos preparando sua conta agora. Siga os três passos abaixo para começar a usar o gerador de orçamentos."}
        </p>

        {/* Passos */}
        <ol className="mt-10 space-y-3 text-left">
          {PASSOS.map((passo, i) => {
            const Icone = passo.icon;
            return (
              <li
                key={passo.titulo}
                className="flex items-start gap-4 rounded-[14px] p-4 transition-colors"
                style={{
                  background: "rgba(120,160,230,0.04)",
                  border: "1px solid rgba(120,160,230,0.12)",
                }}
              >
                <div
                  className="relative grid size-11 shrink-0 place-items-center rounded-full"
                  style={{
                    background: "rgba(62,166,255,0.10)",
                    border: "1px solid rgba(62,166,255,0.25)",
                  }}
                >
                  <Icone className="size-5" style={{ color: "#3ea6ff" }} />
                  <span
                    className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full text-[11px] font-semibold"
                    style={{
                      fontFamily: "var(--font-l2-mono), ui-monospace, monospace",
                      background:
                        "linear-gradient(135deg, #3ea6ff 0%, #1a5cff 100%)",
                      color: "#fff",
                    }}
                  >
                    {i + 1}
                  </span>
                </div>
                <div className="pt-0.5">
                  <h3 className="text-[15px] font-medium tracking-[-0.01em]">
                    {passo.titulo}
                  </h3>
                  <p
                    className="mt-1 text-[13px] leading-relaxed"
                    style={{ color: "#6a7490" }}
                  >
                    {passo.descricao}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* CTAs */}
        <div className="mt-9 flex flex-col gap-3">
          <InstalarAppButton />

          <Link
            href={LOGIN_URL}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: "transparent",
              color: "#e8edf7",
              border: "1px solid rgba(120,160,230,0.18)",
            }}
          >
            Ir para o login
            <ArrowRight className="size-[18px] transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <p className="mt-6 text-xs" style={{ color: "#6a7490" }}>
          Não recebeu o e-mail? Verifique a caixa de spam.
        </p>
      </div>
    </main>
  );
}
