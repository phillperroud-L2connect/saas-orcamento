/** @type {import('next').NextConfig} */

/**
 * Content-Security-Policy da aplicação.
 *
 * Origens externas permitidas (mapeadas a partir do uso real do código):
 *  - https://sdk.mercadopago.com   → SDK JS do checkout (app/checkout/[plano])
 *  - https://api.mercadopago.com   → chamadas à API do Mercado Pago
 *  - https://*.mercadopago.com / *.mercadolibre.com → redirect/iframe do checkout
 *  - https://*.mlstatic.com        → imagens/estáticos do Mercado Pago
 *  - https://*.supabase.co (+wss)  → Auth, banco e Realtime do Supabase
 *  - blob:/data:                   → logos (upload), QR codes e fontes locais
 *
 * 'unsafe-inline' em script-src é necessário porque o Next.js (App Router)
 * injeta scripts inline de hidratação e há um <script> anti-FOUC em layout.tsx.
 * Endurecimento futuro: migrar para CSP baseada em nonce + strict-dynamic.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.mercadopago.com https://*.mlstatic.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://sdk.mercadopago.com",
  "frame-src 'self' https://*.mercadopago.com https://*.mercadolibre.com",
  "form-action 'self' https://*.mercadopago.com",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/** Cabeçalhos de segurança aplicados a todas as respostas. */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig = {
  // Não expõe o header `X-Powered-By: Next.js`.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
