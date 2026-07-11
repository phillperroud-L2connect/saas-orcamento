// Validação de upload de imagem (logo do tenant).
//
// Lógica PURA e sem dependências, deliberadamente em .js (ESM) para poder ser
// importada tanto pelo app (TS, via allowJs) quanto pela suíte `tests.js` que
// roda em Node puro (node --test). Não importa React nem Supabase — só decide
// se um arquivo é aceitável. O enforcement final também é feito no servidor
// (restrição de MIME/tamanho no bucket do Supabase Storage — ver
// supabase-payment-audit-log.sql / configuração do bucket "logos").

/** Tipos MIME aceitos para o logo. SVG é excluído de propósito (vetor de XSS). */
export const LOGO_MIME_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

/** Tamanho máximo do logo, em bytes (2 MB). */
export const LOGO_TAMANHO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Valida um arquivo (ou objeto {type,size}) de logo.
 *
 * @param {{ type?: string, size?: number } | null | undefined} file
 * @returns {{ ok: true } | { ok: false, motivo: "ausente" | "tipo" | "tamanho" }}
 */
export function validarArquivoLogo(file) {
  if (!file) return { ok: false, motivo: "ausente" };

  const tipo = String(file.type ?? "").toLowerCase();
  if (!LOGO_MIME_PERMITIDOS.includes(tipo)) {
    return { ok: false, motivo: "tipo" };
  }

  const tamanho = Number(file.size ?? 0);
  if (!(tamanho > 0) || tamanho > LOGO_TAMANHO_MAX_BYTES) {
    return { ok: false, motivo: "tamanho" };
  }

  return { ok: true };
}
