"use client";

import { useState } from "react";
import { Loader2, CreditCard } from "lucide-react";
import type { Idioma } from "@/lib/types";

const TEXTOS = {
  pt: {
    pagar: "Pagar agora",
    processando: "Abrindo o Mercado Pago...",
    erro: "Não foi possível iniciar o pagamento. Tente novamente.",
  },
  es: {
    pagar: "Pagar ahora",
    processando: "Abriendo Mercado Pago...",
    erro: "No se pudo iniciar el pago. Intentá de nuevo.",
  },
} as const;

/**
 * Botão de pagamento da página pública. Cria a preferência (na conta MP do
 * prestador) e redireciona o cliente para o checkout do Mercado Pago.
 */
export function PagarClient({
  orcamentoId,
  idioma,
  cor,
}: {
  orcamentoId: string;
  idioma: Idioma;
  cor: string;
}) {
  const t = TEXTOS[idioma] ?? TEXTOS.pt;
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function pagar() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/mp/pagar-orcamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orcamentoId }),
      });
      const data = await res.json();
      if (!res.ok || !data.initPoint) {
        setErro(data.erro || t.erro);
        setCarregando(false);
        return;
      }
      window.location.href = data.initPoint as string;
    } catch {
      setErro(t.erro);
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={pagar}
        disabled={carregando}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
        style={{ background: cor }}
      >
        {carregando ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CreditCard className="size-4" />
        )}
        {carregando ? t.processando : t.pagar}
      </button>
      {erro && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-700">
          {erro}
        </p>
      )}
    </div>
  );
}
