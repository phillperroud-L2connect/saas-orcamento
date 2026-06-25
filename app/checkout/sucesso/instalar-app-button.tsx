"use client";

import { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";

// Evento beforeinstallprompt não faz parte do lib.dom padrão.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Botão de destaque que dispara o prompt nativo de instalação do PWA.
 * Captura o evento `beforeinstallprompt` por conta própria (não depende do
 * PwaManager flutuante). Quando o navegador não oferece instalação direta,
 * exibe a instrução manual em vez de esconder o botão.
 */
export default function InstalarAppButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [instalando, setInstalando] = useState(false);
  const [instalado, setInstalado] = useState(false);
  const [mostrarManual, setMostrarManual] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setInstalado(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstalar() {
    if (!deferredPrompt) {
      // Sem prompt nativo (iOS/Safari ou já instalado): mostra o passo a passo.
      setMostrarManual(true);
      return;
    }
    setInstalando(true);
    await deferredPrompt.prompt();
    const escolha = await deferredPrompt.userChoice;
    if (escolha.outcome === "accepted") setInstalado(true);
    setDeferredPrompt(null);
    setInstalando(false);
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleInstalar}
        disabled={instalando || instalado}
        aria-label="Instalar o aplicativo"
        className="group inline-flex w-full items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
        style={{
          background:
            "linear-gradient(135deg, #3ea6ff 0%, #1a5cff 100%)",
          boxShadow:
            "0 8px 28px rgba(62,166,255,0.30), inset 0 1px 0 rgba(255,255,255,0.2)",
        }}
      >
        {instalado ? (
          <Check className="size-[18px]" />
        ) : (
          <Download className="size-[18px]" />
        )}
        {instalado
          ? "App instalado"
          : instalando
            ? "Instalando…"
            : "Instalar o app"}
      </button>

      {mostrarManual && !instalado && (
        <p className="mt-3 text-xs leading-relaxed text-[#6a7490]">
          Seu navegador não oferece instalação automática aqui. Abra o menu do
          navegador e toque em{" "}
          <span className="text-[#aab4c8]">“Instalar app”</span> ou{" "}
          <span className="text-[#aab4c8]">“Adicionar à tela inicial”</span>.
        </p>
      )}
    </div>
  );
}
