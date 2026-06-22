"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Botão de alternância de tema claro/escuro.
 *
 * A fonte da verdade é a classe `.dark` no <html>, aplicada antes da primeira
 * pintura por um script inline no layout raiz (evita flash). Aqui apenas
 * sincronizamos o estado inicial com o que já está no DOM/localStorage e
 * alternamos, persistindo a escolha em localStorage("theme").
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMontado(true);
  }, []);

  function alternar() {
    const novo = !dark;
    setDark(novo);
    const root = document.documentElement;
    root.classList.toggle("dark", novo);
    try {
      localStorage.setItem("theme", novo ? "dark" : "light");
    } catch {
      // localStorage indisponível (modo privado, etc.) — ignora.
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      {/* Antes de montar, renderiza um ícone neutro para evitar mismatch. */}
      {montado && dark ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}
