/**
 * Controle de acesso do Painel Admin.
 *
 * O painel /admin é restrito a um único usuário (o dono do SaaS),
 * identificado por e-mail. A verificação acontece em três camadas:
 *   1. middleware.ts        — bloqueia a navegação até /admin/*
 *   2. app/admin/layout.tsx — revalida no servidor antes de renderizar
 *   3. RLS no Supabase      — políticas que liberam o tenant inteiro só
 *                             para este e-mail (ver supabase-admin.sql)
 */
export const ADMIN_EMAIL = "phillperroud@gmail.com";

/** Subconjunto do usuário do Supabase que nos interessa para identificar o e-mail. */
type UserComEmail = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null | undefined;

/**
 * Resolve o e-mail do usuário olhando todas as fontes possíveis, na ordem:
 *   1. user.email
 *   2. user.user_metadata.email
 *   3. user.user_metadata.sub
 * Usa a primeira fonte com valor (ignora null/undefined/string vazia).
 *
 * Necessário porque, dependendo do provedor/fluxo de cadastro, o e-mail pode
 * vir só dentro de user_metadata e não no campo de topo user.email.
 */
export function resolveUserEmail(user: UserComEmail): string | null {
  const meta = user?.user_metadata ?? {};
  const fontes = [user?.email, meta.email, meta.sub];

  for (const fonte of fontes) {
    if (typeof fonte === "string" && fonte.trim() !== "") {
      return fonte;
    }
  }
  return null;
}

/** Compara e-mails de forma case-insensitive e tolerante a espaços. */
export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}

/** Verifica se o usuário (em qualquer fonte de e-mail) é o admin do SaaS. */
export function isAdminUser(user: UserComEmail): boolean {
  return isAdminEmail(resolveUserEmail(user));
}
