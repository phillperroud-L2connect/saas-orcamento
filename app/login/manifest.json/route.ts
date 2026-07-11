import { NextResponse } from "next/server";

// Manifest do PWA servido sob /login para passar pelo middleware mesmo
// com o usuário deslogado (/login é rota pública). Os ícones .png ficam
// em /public e já são ignorados pelo matcher do middleware.
export const dynamic = "force-static";

export function GET() {
  const manifest = {
    name: "Gerador de Orçamento",
    short_name: "Orçamentos",
    description:
      "Crie e gerencie orçamentos profissionais de forma rápida e simples.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#111827",
    lang: "pt-BR",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
