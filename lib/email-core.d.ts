/**
 * Tipagem do núcleo puro de conteúdo dos e-mails (lib/email-core.js).
 *
 * O runtime mora no .js (importável por `node --test` sem build); este .d.ts dá
 * ao TypeScript os tipos precisos do conteúdo montado.
 */

export type IdiomaEmail = "pt" | "es";

export function escapeHtml(str: unknown): string;

export function conteudoLinkCadastro(params: {
  pais: unknown;
  planoId: string;
  linkCadastro: string;
}): { lang: IdiomaEmail; subject: string; html: string };
