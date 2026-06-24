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
        {children}
        <PwaManager />
      </body>
    </html>
  );
}
