"use client";

import { useEffect, useState } from "react";

/**
 * Detecção de PWA instalável no iOS. Síncrona e defensiva (try/catch): em caso
 * de qualquer erro de ambiente retorna false — nunca lança, nunca bloqueia a UI.
 * Regra: iPhone/iPad + Safari (não Chrome/Firefox/Edge iOS) + app NÃO instalado.
 *
 * No iOS não existe o evento `beforeinstallprompt` (usado no Android/desktop),
 * então a única forma de "instalar" é o passo manual Compartilhar → Adicionar à
 * Tela de Início — e só o Safari oferece esse menu.
 */
export function detectarIosSafariInstalavel(): boolean {
  try {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return false;
    }
    const ua = navigator.userAgent || "";
    const ehIos =
      /iphone|ipad|ipod/i.test(ua) ||
      // iPadOS 13+ se reporta como "MacIntel"; diferencia pelo toque.
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    // No iOS todos os navegadores são WebKit; só o Safari tem "Adicionar à Tela".
    const ehSafari =
      /safari/i.test(ua) && !/crios|fxios|edgios|opios|chrome/i.test(ua);
    const jaInstalado =
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    return ehIos && ehSafari && !jaInstalado;
  } catch (err) {
    console.warn("[pwa] falha na detecção iOS/Safari:", err);
    return false;
  }
}

/**
 * Hook client-only: retorna true só em iPhone/iPad + Safari sem o app instalado.
 * Roda após a montagem para não divergir da renderização do servidor (SSR).
 */
export function useIosSafariInstalavel(): boolean {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    setMostrar(detectarIosSafariInstalavel());
  }, []);
  return mostrar;
}
