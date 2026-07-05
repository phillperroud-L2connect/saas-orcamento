"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import type { Servico } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 dark:focus:border-gray-400 dark:focus:ring-gray-400";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1";

export function ServicosManager() {
  const supabase = createClient();
  const { dict, fmt, simbolo } = useI18n();

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Formulário de novo serviço.
  const [novoNome, setNovoNome] = useState("");
  const [novoPreco, setNovoPreco] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Edição inline de um serviço existente.
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editPreco, setEditPreco] = useState("");

  const ordenarPorNome = (lista: Servico[]) =>
    [...lista].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
    );

  const carregarContexto = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCarregando(false);
      return;
    }
    setUserId(user.id);

    // Resolve o tenant do usuário logado.
    const { data: userRow } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tId = userRow?.tenant_id as string | undefined;
    if (!tId) {
      setCarregando(false);
      return;
    }
    setTenantId(tId);

    // Serviços do tenant (RLS já restringe ao tenant atual).
    const { data: rows } = await supabase
      .from("servicos")
      .select("*")
      .order("nome");
    if (rows) setServicos(rows as Servico[]);
    setCarregando(false);
  }, [supabase]);

  useEffect(() => {
    carregarContexto();
  }, [carregarContexto]);

  async function adicionarServico() {
    setErro(null);
    if (!tenantId) {
      setErro(dict.orc.erroTenant);
      return;
    }
    const nome = novoNome.trim();
    if (!nome) {
      setErro(dict.serv.erroNome);
      return;
    }
    const preco = parseFloat(novoPreco) || 0;

    setSalvando(true);
    const { data, error } = await supabase
      .from("servicos")
      .insert({ tenant_id: tenantId, user_id: userId, nome, preco })
      .select("*")
      .single();
    setSalvando(false);

    if (error) {
      console.error("[ServicosManager] erro ao inserir serviço:", error);
      setErro(dict.serv.erroSalvar);
      return;
    }
    if (data) {
      setServicos((atuais) => ordenarPorNome([...atuais, data as Servico]));
      setNovoNome("");
      setNovoPreco("");
    }
  }

  function iniciarEdicao(s: Servico) {
    setEditId(s.id);
    setEditNome(s.nome);
    setEditPreco(String(s.preco));
    setErro(null);
  }

  function cancelarEdicao() {
    setEditId(null);
    setEditNome("");
    setEditPreco("");
  }

  async function salvarEdicao(id: string) {
    setErro(null);
    const nome = editNome.trim();
    if (!nome) {
      setErro(dict.serv.erroNome);
      return;
    }
    const preco = parseFloat(editPreco) || 0;

    const { data, error } = await supabase
      .from("servicos")
      .update({ nome, preco })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("[ServicosManager] erro ao atualizar serviço:", error);
      setErro(dict.serv.erroAtualizar);
      return;
    }
    if (data) {
      setServicos((atuais) =>
        ordenarPorNome(
          atuais.map((s) => (s.id === id ? (data as Servico) : s)),
        ),
      );
      cancelarEdicao();
    }
  }

  async function deletarServico(id: string) {
    if (!window.confirm(dict.serv.confirmRemover)) return;
    setErro(null);

    const { error } = await supabase.from("servicos").delete().eq("id", id);
    if (error) {
      console.error("[ServicosManager] erro ao deletar serviço:", error);
      setErro(dict.serv.erroRemover);
      return;
    }
    setServicos((atuais) => atuais.filter((s) => s.id !== id));
    if (editId === id) cancelarEdicao();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {dict.serv.titulo}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {dict.serv.subtitulo}
        </p>
      </div>

      {/* Formulário de novo serviço */}
      <section className="mb-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {dict.serv.adicionarTitulo}
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label htmlFor="novo_nome" className={labelCls}>
              {dict.serv.nomeServico} *
            </label>
            <input
              id="novo_nome"
              className={inputCls}
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") adicionarServico();
              }}
              placeholder={dict.serv.nomePlaceholder}
            />
          </div>
          <div className="w-40">
            <label htmlFor="novo_preco" className={labelCls}>
              {dict.serv.precoPadrao(simbolo)}
            </label>
            <input
              id="novo_preco"
              className={inputCls}
              type="number"
              step="0.01"
              min="0"
              value={novoPreco}
              onChange={(e) => setNovoPreco(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") adicionarServico();
              }}
              placeholder="0,00"
            />
          </div>
          <button
            type="button"
            onClick={adicionarServico}
            disabled={salvando || !novoNome.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
          >
            <Plus className="size-4" />
            {salvando ? dict.common.salvando : dict.serv.adicionar}
          </button>
        </div>
        {erro && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}
      </section>

      {/* Lista de serviços */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {dict.serv.catalogo} {servicos.length > 0 && `(${servicos.length})`}
          </h3>
        </div>

        {carregando ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {dict.common.carregando}
          </p>
        ) : servicos.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {dict.serv.nenhum}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {servicos.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                {editId === s.id ? (
                  <>
                    <input
                      className={`${inputCls} min-w-0 flex-1`}
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") salvarEdicao(s.id);
                        if (e.key === "Escape") cancelarEdicao();
                      }}
                      autoFocus
                    />
                    <input
                      className={`${inputCls} w-24 shrink-0 sm:w-32`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={editPreco}
                      onChange={(e) => setEditPreco(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") salvarEdicao(s.id);
                        if (e.key === "Escape") cancelarEdicao();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => salvarEdicao(s.id)}
                      className="rounded-lg p-2 text-green-700 transition hover:bg-green-50"
                      aria-label={dict.common.salvar}
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelarEdicao}
                      className="rounded-lg p-2 text-gray-500 dark:text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800"
                      aria-label={dict.common.cancelar}
                    >
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {s.nome}
                    </span>
                    <span className="w-24 shrink-0 text-right text-sm font-semibold text-gray-900 sm:w-32 dark:text-gray-100">
                      {fmt(s.preco)}
                    </span>
                    <button
                      type="button"
                      onClick={() => iniciarEdicao(s)}
                      className="rounded-lg p-2 text-gray-500 dark:text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800"
                      aria-label={dict.serv.editar}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deletarServico(s.id)}
                      className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"
                      aria-label={dict.serv.remover}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
