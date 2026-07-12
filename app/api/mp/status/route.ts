import { NextResponse } from "next/server";
import { getMercadoPagoClient } from "@/lib/mercadopago";
import { Payment } from "mercadopago";
import { isPlanoId } from "@/lib/planos";
import { normalizarPais } from "@/lib/mp-paises";
import {
  aplicarRateLimit,
  limiterStatus,
  getClientIp,
} from "@/lib/rate-limit";
import { withTimeout } from "@/lib/async";

/** Nunca cacheia: o status muda ao longo do tempo (pendente → aprovado). */
export const dynamic = "force-dynamic";

const MP_TIMEOUT_MS = 8_000;

type StatusResposta = "approved" | "pending" | "none";

/**
 * GET /api/mp/status?plano=<plano>&email=<email>
 *
 * Consulta no Mercado Pago se já existe um pagamento APROVADO para a venda
 * identificada pelo `external_reference` que gravamos na preferência
 * ("<plano>:<email>"). É a fonte da verdade usada pelo polling da tela de
 * checkout para trocar para o estado de sucesso sem depender do e-mail nem de
 * o cliente atualizar a página.
 *
 * Rota pública (o checkout é anônimo). Não expõe dados sensíveis: só devolve
 * um status agregado. Fail-soft: qualquer erro vira "pending" para o cliente
 * seguir aguardando/tentando, nunca um estado de erro que quebre o polling.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const plano = (searchParams.get("plano") ?? "").trim();
  const email = (searchParams.get("email") ?? "").trim();
  // País da conta em que buscar o pagamento (default "AR" p/ fluxo legado).
  const pais = normalizarPais(searchParams.get("pais"));

  // Rate limit por IP: o polling roda a cada ~4s (≈15/min); 60/min dá folga
  // para múltiplas abas. Ao exceder, respondemos "pending" (não 429) para o
  // cliente apenas continuar aguardando sem ver um erro.
  const rl = await aplicarRateLimit(limiterStatus, `status:${getClientIp(req)}`);
  if (!rl.ok) {
    return NextResponse.json({ status: "pending" satisfies StatusResposta });
  }

  if (!isPlanoId(plano) || !email) {
    return NextResponse.json({ status: "none" satisfies StatusResposta });
  }

  // Mesmo formato gravado em app/api/mp/criar-preferencia/route.ts.
  const externalReference = `${plano}:${email}`;

  try {
    const payment = new Payment(getMercadoPagoClient(pais));
    const busca = await withTimeout(
      payment.search({
        options: {
          external_reference: externalReference,
          sort: "date_created",
          criteria: "desc",
        },
      }),
      MP_TIMEOUT_MS,
      "buscar pagamentos no Mercado Pago",
    );

    const resultados = Array.isArray(busca?.results) ? busca.results : [];
    const aprovado = resultados.some((p) => p?.status === "approved");

    const status: StatusResposta = aprovado
      ? "approved"
      : resultados.length > 0
        ? "pending"
        : "none";

    return NextResponse.json({ status });
  } catch (err) {
    console.error("[mp/status] erro ao consultar pagamento:", err);
    // Fail-soft: mantém o cliente aguardando em vez de quebrar o polling.
    return NextResponse.json({ status: "pending" satisfies StatusResposta });
  }
}
