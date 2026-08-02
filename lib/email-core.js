/**
 * Núcleo PURO do conteúdo dos e-mails transacionais (sem rede, sem env, sem DB).
 *
 * Só monta strings (subject + html) a partir de dados já resolvidos. O envio em
 * si (Resend) mora em lib/email.ts. Manter o conteúdo aqui, em .js, permite
 * testar a seleção de idioma e a montagem do corpo direto por `node --test`,
 * sem etapa de build — mesmo padrão de mp-paises.js / payment-audit-core.js.
 *
 * O idioma NÃO é detectado aqui: derivamos do MESMO `pais` que já decide moeda
 * e credenciais no fluxo do pagamento (idiomaDoPais: BR → pt, senão es).
 */

import { idiomaDoPais } from "./mp-paises.js";
import { nomePlanoLocalizado } from "./planos-nomes.js";

/**
 * URL ABSOLUTA do logo (hospedado no WordPress da L2connect). Em e-mail a URL
 * precisa ser pública/absoluta — clientes de e-mail não acessam assets locais.
 * O símbolo é azul/ciano desenhado para brilhar sobre fundo escuro, por isso é
 * sempre exibido dentro de uma faixa #05070d (ver templates), independente de o
 * cliente abrir em modo claro ou escuro.
 */
const LOGO_URL =
  "https://l2connect.com.br/wp-content/uploads/2026/08/logo-orcamentos-sem-backgroud.png";

/** Escapa caracteres perigosos para interpolação segura em HTML. */
export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Corpo (espanhol) do e-mail de link de cadastro — visual escuro do design L2. */
function htmlLinkCadastroEs(planoNomeEsc, link) {
  return `
  <div style="background:#0f172a;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#0f172a">
      <div style="border:1px solid #1e293b;border-radius:16px;padding:32px;background:#111c33">
        <!-- Faixa escura da marca: logo + confirmação lado a lado. O símbolo
             azul/ciano brilha sobre #05070d mesmo em cliente modo claro. -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;background:#05070d;border-radius:12px;margin:0 0 24px">
          <tr>
            <td style="padding:20px 4px 20px 22px;vertical-align:middle;width:56px">
              <img src="${LOGO_URL}" width="56" height="56"
                   alt="L2connect — Generador de Presupuestos"
                   style="display:block;width:56px;height:56px;border:0;outline:none;text-decoration:none">
            </td>
            <td style="padding:20px 22px 20px 16px;vertical-align:middle">
              <span style="color:#f8fafc;font-size:20px;font-weight:700;line-height:1.2;font-family:Arial,Helvetica,sans-serif">¡Pago confirmado! 🎉</span>
            </td>
          </tr>
        </table>
        <p style="color:#cbd5e1;line-height:1.6;font-size:15px;margin:0 0 4px">
          Recibimos tu pago del plan
          <strong style="color:#3ea6ff">${planoNomeEsc}</strong>.
        </p>
        <p style="color:#cbd5e1;line-height:1.6;font-size:15px;margin:0 0 24px">
          Solo falta un paso: creá tu contraseña para activar tu cuenta y
          empezar a generar presupuestos.
        </p>
        <p style="margin:0 0 24px">
          <a href="${link}"
             style="background:#3ea6ff;color:#0f172a;text-decoration:none;padding:14px 26px;border-radius:10px;font-weight:700;font-size:15px;display:inline-block">
            Crear mi contraseña
          </a>
        </p>
        <p style="color:#f59e0b;font-size:13px;line-height:1.6;margin:0 0 20px">
          ⏳ Este enlace expira en 24 horas.
        </p>
        <p style="color:#cbd5e1;font-size:13px;line-height:1.6;margin:0 0 20px">
          💡 Después de entrar, instalá la app en tu celular o computadora para
          abrir el generador con un toque: en el menú del navegador elegí
          <strong style="color:#3ea6ff">“Instalar app”</strong> o
          <strong style="color:#3ea6ff">“Agregar a la pantalla de inicio”</strong>.
        </p>
        <p style="color:#64748b;font-size:12px;line-height:1.6;margin:0 0 24px">
          Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
          <span style="color:#3ea6ff;word-break:break-all">${link}</span>
        </p>
        <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0">
        <!-- Assinatura: logo menor sobre o fundo escuro do card (#111c33). -->
        <p style="margin:0 0 10px">
          <img src="${LOGO_URL}" width="28" height="28"
               alt="L2connect"
               style="display:inline-block;width:28px;height:28px;border:0;outline:none;text-decoration:none;vertical-align:middle">
        </p>
        <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0">
          Equipo L2connect<br>
          <a href="mailto:atendimento@l2connect.com.br" style="color:#3ea6ff;text-decoration:none">atendimento@l2connect.com.br</a>
        </p>
      </div>
    </div>
  </div>`;
}

/** Corpo (português) do e-mail de link de cadastro — mesmo visual, texto PT. */
function htmlLinkCadastroPt(planoNomeEsc, link) {
  return `
  <div style="background:#0f172a;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#0f172a">
      <div style="border:1px solid #1e293b;border-radius:16px;padding:32px;background:#111c33">
        <!-- Faixa escura da marca: logo + confirmação lado a lado. O símbolo
             azul/ciano brilha sobre #05070d mesmo em cliente modo claro. -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;background:#05070d;border-radius:12px;margin:0 0 24px">
          <tr>
            <td style="padding:20px 4px 20px 22px;vertical-align:middle;width:56px">
              <img src="${LOGO_URL}" width="56" height="56"
                   alt="L2connect — Gerador de Orçamento"
                   style="display:block;width:56px;height:56px;border:0;outline:none;text-decoration:none">
            </td>
            <td style="padding:20px 22px 20px 16px;vertical-align:middle">
              <span style="color:#f8fafc;font-size:20px;font-weight:700;line-height:1.2;font-family:Arial,Helvetica,sans-serif">Pagamento confirmado! 🎉</span>
            </td>
          </tr>
        </table>
        <p style="color:#cbd5e1;line-height:1.6;font-size:15px;margin:0 0 4px">
          Recebemos o pagamento do plano
          <strong style="color:#3ea6ff">${planoNomeEsc}</strong>.
        </p>
        <p style="color:#cbd5e1;line-height:1.6;font-size:15px;margin:0 0 24px">
          Falta só um passo: crie sua senha para ativar sua conta e começar a
          gerar orçamentos.
        </p>
        <p style="margin:0 0 24px">
          <a href="${link}"
             style="background:#3ea6ff;color:#0f172a;text-decoration:none;padding:14px 26px;border-radius:10px;font-weight:700;font-size:15px;display:inline-block">
            Criar minha senha
          </a>
        </p>
        <p style="color:#f59e0b;font-size:13px;line-height:1.6;margin:0 0 20px">
          ⏳ Este link expira em 24 horas.
        </p>
        <p style="color:#cbd5e1;font-size:13px;line-height:1.6;margin:0 0 20px">
          💡 Depois de entrar, instale o app no seu celular ou computador para
          abrir o gerador com um toque: no menu do navegador escolha
          <strong style="color:#3ea6ff">“Instalar app”</strong> ou
          <strong style="color:#3ea6ff">“Adicionar à tela inicial”</strong>.
        </p>
        <p style="color:#64748b;font-size:12px;line-height:1.6;margin:0 0 24px">
          Se o botão não funcionar, copie e cole este link no seu navegador:<br>
          <span style="color:#3ea6ff;word-break:break-all">${link}</span>
        </p>
        <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0">
        <!-- Assinatura: logo menor sobre o fundo escuro do card (#111c33). -->
        <p style="margin:0 0 10px">
          <img src="${LOGO_URL}" width="28" height="28"
               alt="L2connect"
               style="display:inline-block;width:28px;height:28px;border:0;outline:none;text-decoration:none;vertical-align:middle">
        </p>
        <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0">
          Equipe L2connect<br>
          <a href="mailto:atendimento@l2connect.com.br" style="color:#3ea6ff;text-decoration:none">atendimento@l2connect.com.br</a>
        </p>
      </div>
    </div>
  </div>`;
}

/** Assunto do e-mail de link de cadastro por idioma. */
const ASSUNTO_LINK_CADASTRO = {
  pt: "Ative sua conta — Gerador de Orçamento",
  es: "Activá tu cuenta — Generador de Presupuestos",
};

/**
 * Conteúdo (idioma + subject + html) do e-mail de link de cadastro enviado logo
 * após o pagamento aprovado. O idioma vem do `pais` (BR → pt, senão es), o mesmo
 * que decide moeda/credenciais — sem detecção nova. O NOME do plano é resolvido
 * pela fonte compartilhada nomePlanoLocalizado, igual ao checkout (pt: Pro =
 * "Completo"; es: "Pro").
 *
 * @param {{ pais: unknown, planoId: string, linkCadastro: string }} params
 * @returns {{ lang: "pt" | "es", subject: string, html: string }}
 */
export function conteudoLinkCadastro({ pais, planoId, linkCadastro }) {
  const lang = idiomaDoPais(pais); // "pt" | "es"
  const nomeEsc = escapeHtml(nomePlanoLocalizado(planoId, lang));
  const link = String(linkCadastro ?? "");
  const html =
    lang === "pt"
      ? htmlLinkCadastroPt(nomeEsc, link)
      : htmlLinkCadastroEs(nomeEsc, link);
  return { lang, subject: ASSUNTO_LINK_CADASTRO[lang], html };
}
