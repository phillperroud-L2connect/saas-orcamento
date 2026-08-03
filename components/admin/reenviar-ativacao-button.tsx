"use client";

import { useState } from "react";
import { Loader2, Send, Check } from "lucide-react";

const MOTIVO_LABEL: Record<string, string> = {
  sem_assinatura_paga: "Sem assinatura paga",
  ja_ativado: "Conta já ativada",
  plano_indefinido: "Plano indefinido",
  onboarding_falhou: "Falha ao enviar — tente de novo",
  nao_autorizado: "Sessão expirada",
};

/**
 * Botão de reenvio manual do link de ativação (linhas "Pago — aguardando
 * cadastro" do painel admin). Chama /api/admin/reenviar-ativacao, que reenvia o
 * e-mail de ativação (PT/ES) via garantirOnboarding com forcarReenvio.
 *
 * Fica desabilitado enquanto envia e, no sucesso, troca para "Enviado ✓" (sem
 * voltar ao estado inicial) para desencorajar cliques repetidos acidentais — o
 * anti-abuso "de verdade" (admin-only + rate limit + regra pago-sem-tenant) está
 * no servidor.
 */
export function ReenviarAtivacaoButton({ email }: { email: string }) {
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado">("idle");
  const [erro, setErro] = useState<string | null>(null);

  async function reenviar() {
    setErro(null);
    setEstado("enviando");
    try {
      const resp = await fetch("/api/admin/reenviar-ativacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(MOTIVO_LABEL[j?.erro] ?? "Falha ao reenviar");
      }
      setEstado("enviado");
    } catch (e) {
      setEstado("idle");
      setErro(e instanceof Error ? e.message : "Falha ao reenviar");
    }
  }

  if (estado === "enviado") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <Check className="size-3.5" />
        Enviado
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={reenviar}
        disabled={estado === "enviando"}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-50 disabled:opacity-60"
      >
        {estado === "enviando" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Send className="size-3.5" />
        )}
        Reenviar link
      </button>
      {erro && <span className="text-[11px] text-red-600">{erro}</span>}
    </div>
  );
}
