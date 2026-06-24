"use client";

import { useEffect, useState } from "react";

// Tipagem do evento beforeinstallprompt (não está no lib.dom padrão).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaManager() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [instalando, setInstalando] = useState(false);

  useEffect(() => {
    // 1) Registra o service worker (servido em /login/sw.js, escopo "/").
    if ("serviceWorker" in navigator) {
      const registrar = () =>
        navigator.serviceWorker
          .register("/login/sw.js", { scope: "/" })
          .catch((err) => console.warn("Falha ao registrar SW:", err));
      // Registra após o load para não competir com o carregamento inicial.
      if (document.readyState === "complete") registrar();
      else window.addEventListener("load", registrar, { once: true });
    }

    // 2) Captura o evento de instalação para exibir nosso próprio botão.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // 3) Some com o botão após a instalação.
    const onInstalled = () => setDeferredPrompt(null);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstalar() {
    if (!deferredPrompt) return;
    setInstalando(true);
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setInstalando(false);
  }

  // Só aparece quando o navegador realmente suporta a instalação do PWA.
  if (!deferredPrompt) return null;

  return (
    <button
      type="button"
      onClick={handleInstalar}
      disabled={instalando}
      aria-label="Instalar aplicativo"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-gray-800 disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {instalando ? "Instalando..." : "Instalar app"}
    </button>
  );
}
