"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Periodo, PlanoId } from "@/lib/planos";
import { TEXTOS, localeMercadoPago, type Lang } from "./i18n";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    MercadoPago?: any;
  }
}

type Props = {
  plano: PlanoId;
  periodo: Periodo;
  lang: Lang;
  publicKey: string;
};

const inputCls =
  "w-full rounded-xl border border-[rgba(120,160,230,0.18)] bg-[rgba(120,160,230,0.05)] px-3.5 py-2.5 text-sm text-[#e8edf7] placeholder-[#6a7490] outline-none transition focus:border-[#3ea6ff]/70 focus:ring-1 focus:ring-[#3ea6ff]/40";
const labelCls = "mb-1.5 block text-xs font-medium text-[#aab4c8]";

/**
 * Formulário de checkout. Coleta os dados do cliente, cria a preferência via
 * /api/mp/criar-preferencia e renderiza o Wallet Brick do Mercado Pago
 * (botão oficial de pagamento) usando a NEXT_PUBLIC_MP_PUBLIC_KEY.
 */
export function CheckoutForm({ plano, periodo, lang, publicKey }: Props) {
  const t = TEXTOS[lang];

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
      const mp = new window.MercadoPago(publicKey, {
        locale: localeMercadoPago(lang),
      });
      mp.bricks().create("wallet", "wallet_container", {
        initialization: { preferenceId },
      });
    } catch (e) {
      console.error("[checkout] falha ao montar wallet:", e);
    }
  }, [preferenceId, publicKey, lang]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim() || !email.trim()) {
      setErro(t.erroNomeEmail);
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch("/api/mp/criar-preferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plano,
          periodo,
          nome: nome.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? t.erroIniciar);
        return;
      }

      setPreferenceId(data.preferenceId);
      setInitPoint(data.initPoint ?? null);
    } catch {
      setErro(t.erroConexao);
    } finally {
      setCarregando(false);
    }
  }

  // Etapa 2: preferência criada → mostra o botão de pagamento do Mercado Pago.
  if (preferenceId) {
    return (
      <div className="mt-6">
        <p className="mb-4 text-sm text-[#aab4c8]">
          {t.saudacao}
          <strong className="text-[#e8edf7]">{nome.trim()}</strong>.{" "}
          {t.finalizeAbaixo}
        </p>
        <div id="wallet_container" ref={walletRef} />
        {initPoint && (
          <a
            href={initPoint}
            className="mt-3 block text-center text-xs text-[#6a7490] underline-offset-2 hover:text-[#aab4c8] hover:underline"
          >
            {t.botaoNaoApareceu}
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
          {t.nomeLabel}
        </label>
        <input
          id="nome"
          className={inputCls}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={t.nomePlaceholder}
          required
        />
      </div>

      <div>
        <label htmlFor="email" className={labelCls}>
          {t.emailLabel}
        </label>
        <input
          id="email"
          type="email"
          className={inputCls}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          required
        />
        <p className="mt-1 text-xs text-[#6a7490]">
          {t.emailHint}
        </p>
      </div>

      <div>
        <label htmlFor="whatsapp" className={labelCls}>
          {t.whatsappLabel}{" "}
          <span className="text-[#6a7490]">{t.whatsappOpcional}</span>
        </label>
        <input
          id="whatsapp"
          className={inputCls}
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder={t.whatsappPlaceholder}
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
        className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
        style={{
          backgroundImage: "linear-gradient(135deg, #3ea6ff 0%, #1a5cff 100%)",
          boxShadow:
            "0 8px 28px rgba(62,166,255,0.30), inset 0 1px 0 rgba(255,255,255,0.2)",
        }}
      >
        {carregando && <Loader2 className="size-4 animate-spin" />}
        {carregando ? t.btnPreparando : t.btnIr}
      </button>
    </form>
  );
}
