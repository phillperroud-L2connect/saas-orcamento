"use client";

import { useState } from "react";
import { Share, X } from "lucide-react";
import { useIosSafariInstalavel } from "./use-ios-install";

/**
 * Banner dispensável que ensina a instalar o PWA no iPhone/iPad. O Safari iOS
 * não dispara `beforeinstallprompt`, então não há botão automático — mostramos
 * a instrução manual (Compartilhar → Adicionar à Tela de Início).
 *
 * Só aparece em iOS+Safari com o app ainda não instalado, é fechável e nunca
 * bloqueia o conteúdo da página. Adapta-se ao tema claro/escuro para combinar
 * com o card de login, mantendo o acento azul da marca (#3ea6ff → blue-500).
 */
export default function IosInstallBanner() {
  const mostrar = useIosSafariInstalavel();
  const [fechado, setFechado] = useState(false);

  if (!mostrar || fechado) return null;

  return (
    <div
      role="note"
      className="mx-auto mb-4 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
          <Share className="size-4" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Instalar o app no iPhone
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
            Toque em{" "}
            <span className="font-medium text-blue-600 dark:text-blue-400">
              Compartilhar
            </span>{" "}
            na barra do Safari e depois em{" "}
            <span className="font-medium text-blue-600 dark:text-blue-400">
              “Adicionar à Tela de Início”
            </span>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFechado(true)}
          aria-label="Fechar aviso de instalação"
          className="shrink-0 rounded-full p-1 text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
