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

type LinkCadastroParams = {
  /** E-mail do pagador, destinatário do link de cadastro. */
  email: string;
  plano: Plano;
  /** Link tokenizado: https://.../cadastro?token=<token> */
  linkCadastro: string;
};

/**
 * E-mail enviado logo após o pagamento aprovado, com o link tokenizado para o
 * cliente criar a senha e ativar a conta. Visual escuro (#0f172a) com azul
 * (#3ea6ff), texto em espanhol. Best-effort (ver getResend).
 */
export async function enviarLinkCadastro({
  email,
  plano,
  linkCadastro,
}: LinkCadastroParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const html = `
  <div style="background:#0f172a;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#0f172a">
      <div style="border:1px solid #1e293b;border-radius:16px;padding:32px;background:#111c33">
        <h1 style="font-size:22px;margin:0 0 8px;color:#f8fafc;font-weight:700">
          ¡Pago confirmado! 🎉
        </h1>
        <p style="color:#cbd5e1;line-height:1.6;font-size:15px;margin:0 0 4px">
          Recibimos tu pago del plan
          <strong style="color:#3ea6ff">${escapeHtml(plano.nome)}</strong>.
        </p>
        <p style="color:#cbd5e1;line-height:1.6;font-size:15px;margin:0 0 24px">
          Solo falta un paso: creá tu contraseña para activar tu cuenta y
          empezar a generar presupuestos.
        </p>
        <p style="margin:0 0 24px">
          <a href="${linkCadastro}"
             style="background:#3ea6ff;color:#0f172a;text-decoration:none;padding:14px 26px;border-radius:10px;font-weight:700;font-size:15px;display:inline-block">
            Crear mi contraseña
          </a>
        </p>
        <p style="color:#f59e0b;font-size:13px;line-height:1.6;margin:0 0 20px">
          ⏳ Este enlace expira en 24 horas.
        </p>
        <p style="color:#64748b;font-size:12px;line-height:1.6;margin:0 0 24px">
          Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
          <span style="color:#3ea6ff;word-break:break-all">${linkCadastro}</span>
        </p>
        <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0">
        <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0">
          Equipo L2connect<br>
          <a href="mailto:philip@l2connect.com.br" style="color:#3ea6ff;text-decoration:none">philip@l2connect.com.br</a>
        </p>
      </div>
    </div>
  </div>`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Activá tu cuenta — Generador de Presupuestos",
    html,
  });

  if (error) {
    console.error("[email] Falha ao enviar link de cadastro:", error);
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

type RecuperacaoAdminParams = {
  /** E-mail do administrador (destinatário). */
  email: string;
  /** Link tokenizado para redefinir a senha do admin. */
  link: string;
};

/**
 * E-mail de recuperação de senha do PAINEL ADMINISTRATIVO. Assunto e corpo
 * deixam explícito que é o acesso admin (não confundir com a recuperação de
 * usuário comum). Best-effort (ver getResend): não lança se a chave faltar.
 */
export async function enviarRecuperacaoAdmin({
  email,
  link,
}: RecuperacaoAdminParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const html = `
  <div style="background:#0A0A0A;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto">
      <div style="border:1px solid #1f1f1f;border-radius:16px;padding:32px;background:#111">
        <p style="color:#f59e0b;font-size:12px;font-weight:700;letter-spacing:.08em;margin:0 0 8px">
          🛡️ ACESSO ADMINISTRATIVO
        </p>
        <h1 style="font-size:22px;margin:0 0 8px;color:#fafafa;font-weight:700">
          Redefinição de senha do painel admin
        </h1>
        <p style="color:#a3a3a3;line-height:1.6;font-size:15px;margin:0 0 24px">
          Você solicitou a redefinição da senha do
          <strong style="color:#fafafa">Painel Administrativo</strong> do Gerador
          de Orçamento. Este link é exclusivo do acesso admin — não tem relação
          com contas de usuários comuns.
        </p>
        <p style="margin:0 0 24px">
          <a href="${link}"
             style="background:#fff;color:#0A0A0A;text-decoration:none;padding:14px 26px;border-radius:10px;font-weight:700;font-size:15px;display:inline-block">
            Redefinir senha do admin
          </a>
        </p>
        <p style="color:#f59e0b;font-size:13px;line-height:1.6;margin:0 0 20px">
          ⏳ O link expira em ~1 hora e só pode ser usado uma vez.
        </p>
        <p style="color:#737373;font-size:12px;line-height:1.6;margin:0">
          Se não foi você que pediu, ignore este e-mail — a senha atual continua
          válida.<br>
          <span style="color:#a3a3a3;word-break:break-all">${link}</span>
        </p>
      </div>
    </div>
  </div>`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: "[ADMIN] Redefinição de acesso administrativo — Gerador de Orçamento",
    html,
  });

  if (error) {
    console.error("[email] Falha ao enviar recuperação do admin:", error);
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
