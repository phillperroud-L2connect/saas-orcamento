import { Resend } from "resend";
import type { Plano } from "@/lib/planos";

/**
 * Camada de e-mail transacional via Resend.
 *
 * Requer RESEND_API_KEY no .env.local. As funções são "best-effort": se a chave
 * não estiver configurada, registram um aviso e retornam sem lançar, para não
 * derrubar o webhook de pagamento (o tenant já foi criado com sucesso).
 */

const FROM =
  process.env.RESEND_FROM ?? "Gerador de Orçamento <onboarding@resend.dev>";

/** E-mail do dono do SaaS que recebe a notificação de nova venda. */
const ADMIN_NOTIFY =
  process.env.ADMIN_NOTIFY_EMAIL ?? "phillperroud@gmail.com";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY ausente — e-mail não enviado.");
    return null;
  }
  return new Resend(key);
}

type BoasVindasParams = {
  nome: string;
  email: string;
  plano: Plano;
  /** Link onde o cliente define a senha / acessa o painel. */
  linkAcesso: string;
};

/** E-mail de boas-vindas ao novo cliente, com link de acesso ao painel. */
export async function enviarBoasVindas({
  nome,
  email,
  plano,
  linkAcesso,
}: BoasVindasParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#171717">
    <h1 style="font-size:22px;margin:0 0 8px">¡Bienvenido, ${escapeHtml(nome)}! 🎉</h1>
    <p style="color:#555;line-height:1.6">
      Tu pago del plan <strong>${escapeHtml(plano.nome)}</strong> fue confirmado.
      Tu cuenta ya está activa.
    </p>
    <p style="color:#555;line-height:1.6">
      Hacé clic en el botón para definir tu contraseña y acceder al panel:
    </p>
    <p style="margin:24px 0">
      <a href="${linkAcesso}"
         style="background:#0f0f0f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">
        Acceder a mi cuenta
      </a>
    </p>
    <p style="color:#999;font-size:12px;line-height:1.6">
      Si el botón no funciona, copiá este enlace:<br>
      <span style="color:#666">${linkAcesso}</span>
    </p>
  </div>`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Tu cuenta está lista 🎉 — Generador de Presupuestos",
    html,
  });

  if (error) {
    console.error("[email] Falha ao enviar boas-vindas:", error);
  }
}

type NotificacaoAdminParams = {
  nome: string;
  email: string;
  whatsapp?: string | null;
  plano: Plano;
};

/** Notifica o painel admin (por e-mail) sobre uma nova venda confirmada. */
export async function notificarAdminNovaVenda({
  nome,
  email,
  whatsapp,
  plano,
}: NotificacaoAdminParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#171717">
    <h2 style="font-size:18px;margin:0 0 12px">🟢 Nova venda confirmada</h2>
    <table style="font-size:14px;color:#333;border-collapse:collapse">
      <tr><td style="padding:4px 12px 4px 0;color:#888">Plano</td><td><strong>${escapeHtml(plano.nome)}</strong> (${plano.moeda} ${plano.preco})</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#888">Cliente</td><td>${escapeHtml(nome)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#888">E-mail</td><td>${escapeHtml(email)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#888">WhatsApp</td><td>${escapeHtml(whatsapp ?? "—")}</td></tr>
    </table>
  </div>`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: ADMIN_NOTIFY,
    subject: `🟢 Nova venda: ${plano.nome} — ${nome}`,
    html,
  });

  if (error) {
    console.error("[email] Falha ao notificar admin:", error);
  }
}

type PagamentoPrestadorParams = {
  /** E-mail do prestador (tenant.email) que recebe a notificação. */
  para: string;
  nomeCliente?: string | null;
  numero?: string | null;
  valor: string; // já formatado na moeda do orçamento
};

/**
 * Notifica o PRESTADOR de que um cliente pagou um orçamento dele via Mercado
 * Pago. Best-effort (ver getResend): não lança se a chave estiver ausente.
 */
export async function notificarPrestadorPagamento({
  para,
  nomeCliente,
  numero,
  valor,
}: PagamentoPrestadorParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const ref = numero ? ` ${escapeHtml(numero)}` : "";
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#171717">
    <h2 style="font-size:19px;margin:0 0 12px">💰 Você recebeu um pagamento</h2>
    <p style="color:#555;line-height:1.6">
      O orçamento${ref} foi pago pelo seu cliente
      ${nomeCliente ? `<strong>${escapeHtml(nomeCliente)}</strong>` : ""} via Mercado Pago.
    </p>
    <table style="font-size:14px;color:#333;border-collapse:collapse;margin-top:8px">
      <tr><td style="padding:4px 12px 4px 0;color:#888">Valor</td><td><strong>${escapeHtml(valor)}</strong></td></tr>
      ${numero ? `<tr><td style="padding:4px 12px 4px 0;color:#888">Orçamento</td><td>${escapeHtml(numero)}</td></tr>` : ""}
    </table>
    <p style="color:#999;font-size:12px;line-height:1.6;margin-top:16px">
      O valor cai diretamente na sua conta do Mercado Pago.
    </p>
  </div>`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: para,
    subject: `💰 Pagamento recebido${ref} — ${valor}`,
    html,
  });

  if (error) {
    console.error("[email] Falha ao notificar prestador do pagamento:", error);
  }
}

/** Escapa caracteres perigosos para interpolação segura em HTML. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
