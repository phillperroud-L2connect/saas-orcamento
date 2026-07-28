"use client";

/**
 * UI compartilhada de "mostrar/esconder blocos" (feature exclusiva do Plano Pro).
 *
 * Componente puramente presentacional e controlado: recebe o template atual, o
 * idioma, o valor (`value` = blocos que o tenant escolheu esconder) e devolve o
 * novo valor por `onChange`. Toda a regra de quais blocos existem, quais nascem
 * ocultos por padrão e como se lê cada nome mora nos núcleos puros
 * (lib/blocos-core, lib/blocos-rotulos) — aqui só se pinta.
 *
 * Consumido por dois lugares (fonte única da verdade da UI):
 *   - o fluxo real de criação de orçamento (components/orcamentos-manager);
 *   - a rota de preview isolada (app/preview-toggles).
 *
 * Semântica: checkbox marcado = bloco visível. Os blocos que nascem ocultos por
 * padrão (BLOCOS_PADRAO_OCULTOS — sem fonte de dado no formulário) aparecem
 * DESABILITADOS com a nota "sem dados", porque resolverBlocos os esconde de
 * qualquer forma. `value` nunca contém esses ids: é só a escolha do tenant sobre
 * os blocos que têm dado.
 */
import { blocosDoTemplate, resolverBlocos } from "@/lib/blocos-core";
import { rotuloBloco } from "@/lib/blocos-rotulos";

type Idioma = "pt" | "es";

/** Sufixo "sem dados" ao lado dos blocos padrão-ocultos, por idioma. */
const SEM_DADOS: Record<Idioma, string> = {
  pt: "sem dados neste formulário",
  es: "sin datos en este formulario",
};

export type BlocosTogglesProps = {
  /** Template selecionado (TemplateId). Determina a lista de blocos. */
  templateId: string;
  idioma: Idioma;
  /** Blocos que o tenant escolheu esconder (só ids com dado; nunca padrão-ocultos). */
  value: string[];
  /** Recebe a nova lista de ocultos do tenant a cada toggle. */
  onChange: (proximo: string[]) => void;
  className?: string;
};

export default function BlocosToggles({
  templateId,
  idioma,
  value,
  onChange,
  className,
}: BlocosTogglesProps) {
  const catalogo = blocosDoTemplate(templateId);
  // Blocos que aparecem no documento padrão (catálogo menos os padrão-ocultos).
  // Um id do catálogo que não está aqui é padrão-oculto (sem fonte de dado) e
  // vem desabilitado. Usa só as funções puras — sem indexar o mapa tipado.
  const visiveisPadrao = new Set(resolverBlocos(templateId, []));
  const ocultos = new Set(value);

  function toggle(id: string) {
    const proximo = new Set(ocultos);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    onChange(Array.from(proximo));
  }

  return (
    <ul className={`flex flex-col gap-0.5 ${className ?? ""}`}>
      {catalogo.map((id) => {
        const desabilitado = !visiveisPadrao.has(id);
        const marcado = !desabilitado && !ocultos.has(id);
        return (
          <li key={id}>
            <label
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition ${
                desabilitado
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <input
                type="checkbox"
                checked={marcado}
                disabled={desabilitado}
                onChange={() => toggle(id)}
                className="size-4 shrink-0 accent-emerald-600 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-gray-800 dark:text-gray-100">
                {rotuloBloco(id, idioma)}
              </span>
              {desabilitado && (
                <span className="ml-auto text-[11px] italic text-gray-400 dark:text-gray-500">
                  {SEM_DADOS[idioma]}
                </span>
              )}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
