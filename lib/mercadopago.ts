import { MercadoPagoConfig } from "mercadopago";

/**
 * Configuração do SDK do Mercado Pago (conta da Argentina).
 *
 * Usa o MP_ACCESS_TOKEN (privado, server-side). A NEXT_PUBLIC_MP_PUBLIC_KEY é
 * usada apenas no browser (Wallet Brick) e não entra aqui.
 */
export function getMercadoPagoClient(): MercadoPagoConfig {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MP_ACCESS_TOKEN não definido no .env.local.");
  }
  return new MercadoPagoConfig({
    accessToken,
    options: { timeout: 8000 },
  });
}

/**
 * URL base pública da aplicação, usada para montar back_urls e o link de
 * notificação (webhook) do Mercado Pago. Em produção defina NEXT_PUBLIC_SITE_URL.
 */
export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}
