"use client";

import { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";
import { detectarIosSafariInstalavel } from "@/components/use-ios-install";

// Evento beforeinstallprompt não faz parte do lib.dom padrão.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __l2Install?: { evt: BeforeInstallPromptEvent | null; installed: boolean };
  }
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
  const [ehIosSafari, setEhIosSafari] = useState(false);

  useEffect(() => {
    setEhIosSafari(detectarIosSafariInstalavel());
  }, []);

  useEffect(() => {
    // Lê o evento já capturado pelo script global do layout raiz (que roda antes
    // da hidratação e evita a corrida em que o beforeinstallprompt é perdido).
    try {
      const g = window.__l2Install;
      if (g?.installed) setInstalado(true);
      else if (g?.evt) setDeferredPrompt(g.evt);
    } catch (err) {
      console.warn("[pwa] falha ao ler prompt de instalação:", err);
    }
    // Caso o evento chegue depois da montagem, o script global emite 'l2installready'.
    const onReady = () => {
      try {
        const g = window.__l2Install;
        if (g?.evt) setDeferredPrompt(g.evt);
      } catch (err) {
        console.warn("[pwa] falha no l2installready:", err);
      }
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setInstalado(true);
    };
    window.addEventListener("l2installready", onReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("l2installready", onReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstalar() {
    // A instalação SÓ acontece a partir daqui — sempre exige o clique do usuário.
    if (!deferredPrompt) {
      // Sem prompt nativo (iOS/Safari, heurística ainda não liberou, ou já
      // instalado): mostra o passo a passo manual — sempre há reação visível.
      setMostrarManual(true);
      return;
    }
    setInstalando(true);
    try {
      await deferredPrompt.prompt();
      const escolha = await deferredPrompt.userChoice;
      if (escolha.outcome === "accepted") setInstalado(true);
    } catch (err) {
      console.warn("[pwa] falha ao disparar a instalação:", err);
      setMostrarManual(true);
    } finally {
      setDeferredPrompt(null);
      setInstalando(false);
    }
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
          {ehIosSafari ? (
            <>
              Toque em <span className="text-[#aab4c8]">Compartilhar</span> na
              barra do Safari e depois em{" "}
              <span className="text-[#aab4c8]">“Adicionar à Tela de Início”</span>.
            </>
          ) : (
            <>
              Seu navegador não oferece instalação automática aqui. Abra o menu
              do navegador e toque em{" "}
              <span className="text-[#aab4c8]">“Instalar app”</span> ou{" "}
              <span className="text-[#aab4c8]">“Adicionar à tela inicial”</span>.
            </>
          )}
        </p>
      )}
    </div>
  );
}
