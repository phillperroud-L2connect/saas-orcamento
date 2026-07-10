import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import PwaManager from "@/components/PwaManager";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  applicationName: "Gerador de Orçamento",
  title: {
    default: "Gerador de Orçamento",
    template: "%s | Gerador de Orçamento",
  },
  description:
    "Crie e gerencie orçamentos profissionais de forma rápida e simples.",
  manifest: "/login/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Orçamentos",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Anti-flash (FOUC): aplica o tema salvo antes da primeira pintura. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
        {/* Captura o evento de instalação do PWA o mais cedo possível (antes da
            hidratação do React), evitando a corrida em que o beforeinstallprompt
            dispara antes dos componentes montarem seus listeners. Apenas ARMAZENA
            o evento — a instalação só é disparada pelo clique do usuário no botão. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{window.__l2Install=window.__l2Install||{evt:null,installed:false};window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__l2Install.evt=e;try{window.dispatchEvent(new Event('l2installready'));}catch(_){}});window.addEventListener('appinstalled',function(){window.__l2Install.evt=null;window.__l2Install.installed=true;});}catch(e){}})();`,
          }}
        />
        {children}
        <PwaManager />
      </body>
    </html>
  );
}
