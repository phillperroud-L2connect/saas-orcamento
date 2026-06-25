"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { PlanoId } from "@/lib/planos";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    MercadoPago?: any;
  }
}

type Props = {
  plano: PlanoId;
  publicKey: string;
};

const inputCls =
  "w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/40";
const labelCls = "mb-1.5 block text-xs font-medium text-white/55";

/**
 * Formulário de checkout. Coleta os dados do cliente, cria a preferência via
 * /api/mp/criar-preferencia e renderiza o Wallet Brick do Mercado Pago
 * (botão oficial de pagamento) usando a NEXT_PUBLIC_MP_PUBLIC_KEY.
 */
export function CheckoutForm({ plano, publicKey }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [initPoint, setInitPoint] = useState<string | null>(null);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);

  const walletRef = useRef<HTMLDivElement>(null);

  // Monta o Wallet Brick assim que a preferência é criada e o SDK carregou.
  useEffect(() => {
    if (!preferenceId || !walletRef.current) return;
    if (!publicKey || typeof window === "undefined" || !window.MercadoPago) return;

    walletRef.current.innerHTML = "";
    try {
      const mp = new window.MercadoPago(publicKey, { locale: "es-AR" });
      mp.bricks().create("wallet", "wallet_container", {
        initialization: { preferenceId },
      });
    } catch (e) {
      console.error("[checkout] falha ao montar wallet:", e);
    }
  }, [preferenceId, publicKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim() || !email.trim()) {
      setErro("Preencha nome e e-mail.");
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch("/api/mp/criar-preferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plano,
          nome: nome.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Não foi possível iniciar o pagamento.");
        return;
      }

      setPreferenceId(data.preferenceId);
      setInitPoint(data.initPoint ?? null);
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  // Etapa 2: preferência criada → mostra o botão de pagamento do Mercado Pago.
  if (preferenceId) {
    return (
      <div className="mt-6">
        <p className="mb-4 text-sm text-white/60">
          Tudo certo, <strong className="text-white">{nome.trim()}</strong>.
          Finalize o pagamento abaixo:
        </p>
        <div id="wallet_container" ref={walletRef} />
        {initPoint && (
          <a
            href={initPoint}
            className="mt-3 block text-center text-xs text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
          >
            O botão não apareceu? Pagar pelo Mercado Pago →
          </a>
        )}
      </div>
    );
  }

  // Etapa 1: dados do cliente.
  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="nome" className={labelCls}>
          Nome completo *
        </label>
        <input
          id="nome"
          className={inputCls}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Como devemos te chamar"
          required
        />
      </div>

      <div>
        <label htmlFor="email" className={labelCls}>
          E-mail *
        </label>
        <input
          id="email"
          type="email"
          className={inputCls}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com"
          required
        />
        <p className="mt-1 text-xs text-white/30">
          É aqui que enviaremos o acesso à sua conta.
        </p>
      </div>

      <div>
        <label htmlFor="whatsapp" className={labelCls}>
          WhatsApp <span className="text-white/30">(opcional)</span>
        </label>
        <input
          id="whatsapp"
          className={inputCls}
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="+54 9 11 1234-5678"
        />
      </div>

      {erro && (
        <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={carregando}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#0A0A0A] transition hover:bg-emerald-300 disabled:opacity-60"
      >
        {carregando && <Loader2 className="size-4 animate-spin" />}
        {carregando ? "Preparando pagamento..." : "Ir para o pagamento"}
      </button>
    </form>
  );
}
