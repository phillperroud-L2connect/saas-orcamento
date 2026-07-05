import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createServiceSupabase } from "@/lib/supabase-service";
import { isAdminUser } from "@/lib/admin";
import { withTimeout } from "@/lib/async";

const DB_TIMEOUT_MS = 8_000;

/**
 * POST /api/admin/excluir-tenant  { tenantId }
 *
 * Exclusão PERMANENTE de um tenant e de tudo ligado a ele. Só o admin executa
 * (revalida a sessão no servidor). Remove:
 *   1. assinaturas do tenant (senão o SET NULL as faria reaparecer no admin
 *      como "aguardando cadastro");
 *   2. o tenant (cascata → clientes/orcamentos/pagamentos/pagamentos_avulsos/users);
 *   3. os usuários do Supabase Auth vinculados (não caem na cascata do tenant).
 */
export async function POST(req: NextRequest) {
  // 1. Só o admin logado pode excluir.
  const authClient = createServerSupabase();
  const {
    data: { user },
  } = await withTimeout(
    authClient.auth.getUser(),
    DB_TIMEOUT_MS,
    "validar sessão do admin",
  );
  if (!isAdminUser(user)) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 403 });
  }

  let body: { tenantId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "payload" }, { status: 400 });
  }
  const tenantId = (body.tenantId ?? "").trim();
  if (!tenantId) {
    return NextResponse.json({ erro: "tenant_ausente" }, { status: 400 });
  }

  try {
    const svc = createServiceSupabase();

    // 2. Coleta os usuários do Auth ANTES da cascata apagar public.users.
    const { data: usuarios } = await withTimeout(
      svc.from("users").select("id").eq("tenant_id", tenantId),
      DB_TIMEOUT_MS,
      "listar usuários do tenant",
    );

    // 3. Remove o histórico de assinaturas (evita SET NULL → "aguardando cadastro").
    await withTimeout(
      svc.from("assinaturas").delete().eq("tenant_id", tenantId),
      DB_TIMEOUT_MS,
      "excluir assinaturas do tenant",
    );

    // 4. Remove o tenant (cascata cuida de clientes/orcamentos/pagamentos/users).
    const { error: tenantErr } = await withTimeout(
      svc.from("tenants").delete().eq("id", tenantId),
      DB_TIMEOUT_MS,
      "excluir tenant",
    );
    if (tenantErr) {
      console.error("[admin/excluir-tenant] erro ao excluir tenant:", tenantErr);
      return NextResponse.json({ erro: "db" }, { status: 500 });
    }

    // 5. Remove os usuários do Supabase Auth (não caem na cascata do tenant).
    for (const u of usuarios ?? []) {
      try {
        await withTimeout(
          svc.auth.admin.deleteUser((u as { id: string }).id),
          DB_TIMEOUT_MS,
          "excluir usuário do Auth",
        );
      } catch (delErr) {
        // Não aborta o restante: o tenant já foi removido; loga o órfão do Auth.
        console.error("[admin/excluir-tenant] falha ao excluir auth user:", delErr);
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[admin/excluir-tenant] erro inesperado:", err);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
}
