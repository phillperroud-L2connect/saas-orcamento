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

/** Compara e-mails de forma case-insensitive e tolerante a espaços. */
export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}
