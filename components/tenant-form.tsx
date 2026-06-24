"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Check, ImageOff } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Tenant, Idioma, Pais, MoedaPreferida } from "@/lib/types";

const BUCKET = "logos";

/**
 * País derivado do idioma — mantém a coluna `pais` (NOT NULL) consistente
 * sem expor um campo extra. Português -> Brasil, Español -> Argentina.
 */
const PAIS_POR_IDIOMA: Record<Idioma, Pais> = { pt: "BR", es: "AR" };

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900";
const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

type Props = {
  /** Tenant existente (modo edição) ou null (modo criação). */
  tenant?: Tenant | null;
};

export function TenantForm({ tenant }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editando = Boolean(tenant);

  const [nomeEmpresa, setNomeEmpresa] = useState(tenant?.nome_empresa ?? "");
  const [nomeProfissional, setNomeProfissional] = useState(
    tenant?.nome_profissional ?? "",
  );
  const [email, setEmail] = useState(tenant?.email ?? "");
  const [telefone, setTelefone] = useState(tenant?.telefone ?? "");
  const [corPrimaria, setCorPrimaria] = useState(
    tenant?.cor_primaria ?? "#0F0F0F",
  );
  const [idioma, setIdioma] = useState<Idioma>(tenant?.idioma ?? "pt");
  // Moeda escolhida quando idioma = es (Português usa BRL fixo).
  const [moedaPreferida, setMoedaPreferida] = useState<MoedaPreferida>(
    tenant?.moeda_preferida && tenant.moeda_preferida !== "BRL"
      ? tenant.moeda_preferida
      : "ARS",
  );
  const [ativo, setAtivo] = useState<boolean>(tenant?.ativo ?? true);

  const [logoUrl, setLogoUrl] = useState<string | null>(tenant?.logo_url ?? null);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErro("O logo precisa ser um arquivo de imagem.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErro("O logo deve ter no máximo 2 MB.");
      return;
    }

    setErro(null);
    setEnviandoLogo(true);

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${tenant?.id ?? "novos"}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) {
      setErro(`Falha no upload do logo: ${upErr.message}`);
      setEnviandoLogo(false);
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setEnviandoLogo(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nomeEmpresa.trim() || !email.trim()) {
      setErro("Nome da empresa e e-mail são obrigatórios.");
      return;
    }

    setSalvando(true);

    const payload = {
      nome_empresa: nomeEmpresa.trim(),
      nome_profissional: nomeProfissional.trim() || null,
      email: email.trim(),
      telefone: telefone.trim() || null,
      logo_url: logoUrl,
      cor_primaria: corPrimaria,
      // País derivado do idioma (coluna NOT NULL, check BR/AR).
      pais: PAIS_POR_IDIOMA[idioma],
      idioma,
      // Português -> BRL fixo; Español -> moeda escolhida (ARS ou USD).
      moeda_preferida: idioma === "pt" ? "BRL" : moedaPreferida,
      ativo,
    };

    const query = editando
      ? supabase.from("tenants").update(payload).eq("id", tenant!.id)
      : supabase.from("tenants").insert(payload);

    const { error } = await query;
    setSalvando(false);

    if (error) {
      setErro(`Erro ao salvar: ${error.message}`);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Identidade */}
      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Identidade</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nome_empresa" className={labelCls}>
              Nome da empresa *
            </label>
            <input
              id="nome_empresa"
              className={inputCls}
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              placeholder="Ex.: Zamy Design"
              required
            />
          </div>
          <div>
            <label htmlFor="nome_profissional" className={labelCls}>
              Nome do profissional
            </label>
            <input
              id="nome_profissional"
              className={inputCls}
              value={nomeProfissional}
              onChange={(e) => setNomeProfissional(e.target.value)}
              placeholder="Ex.: Maria Zamy"
            />
          </div>
          <div>
            <label htmlFor="email" className={labelCls}>
              E-mail *
            </label>
            <input
              id="email"
              type="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@empresa.com"
              required
            />
          </div>
          <div>
            <label htmlFor="telefone" className={labelCls}>
              Telefone
            </label>
            <input
              id="telefone"
              className={inputCls}
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="+55 11 99999-9999"
            />
          </div>
        </div>
      </section>

      {/* Marca */}
      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Marca</h2>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Logo */}
          <div>
            <label className={labelCls}>Logo</label>
            <div className="flex items-center gap-4">
              <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Logo do tenant"
                    className="size-full object-cover"
                  />
                ) : (
                  <ImageOff className="size-5 text-gray-300" />
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={enviandoLogo}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                >
                  {enviandoLogo ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {enviandoLogo ? "Enviando..." : "Enviar imagem"}
                </button>
                <p className="mt-1 text-xs text-gray-400">PNG ou JPG, até 2 MB.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </div>

          {/* Cor primária */}
          <div>
            <label htmlFor="cor" className={labelCls}>
              Cor primária
            </label>
            <div className="flex items-center gap-3">
              <input
                id="cor"
                type="color"
                value={corPrimaria}
                onChange={(e) => setCorPrimaria(e.target.value)}
                className="size-11 cursor-pointer rounded-lg border border-gray-300 bg-white p-1"
              />
              <input
                aria-label="Código hexadecimal da cor"
                className={`${inputCls} font-mono uppercase`}
                value={corPrimaria}
                onChange={(e) => setCorPrimaria(e.target.value)}
                placeholder="#0F0F0F"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Configuração regional */}
      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Configuração</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="idioma" className={labelCls}>
              Idioma do app
            </label>
            <select
              id="idioma"
              className={inputCls}
              value={idioma}
              onChange={(e) => setIdioma(e.target.value as Idioma)}
            >
              <option value="pt">🇧🇷 Português</option>
              <option value="es">🇦🇷 Español</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              {idioma === "pt"
                ? "Moeda fixa: BRL (R$)."
                : "Escolha a moeda dos orçamentos ao lado."}
            </p>
          </div>

          {/* Moeda — só para Español (Português usa BRL fixo) */}
          {idioma === "es" && (
            <div>
              <label htmlFor="moeda" className={labelCls}>
                Moeda
              </label>
              <select
                id="moeda"
                className={inputCls}
                value={moedaPreferida}
                onChange={(e) =>
                  setMoedaPreferida(e.target.value as MoedaPreferida)
                }
              >
                <option value="ARS">ARS — Peso argentino</option>
                <option value="USD">USD — Dólar</option>
              </select>
            </div>
          )}
        </div>

        {/* Ativo */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Tenant ativo</p>
            <p className="text-xs text-gray-400">
              Desative para suspender o acesso desta empresa.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={ativo}
            onClick={() => setAtivo((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
              ativo ? "bg-emerald-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block size-4 transform rounded-full bg-white shadow transition ${
                ativo ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>

      {erro && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={salvando || enviandoLogo}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
        >
          {salvando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          {salvando
            ? "Salvando..."
            : editando
              ? "Salvar alterações"
              : "Criar tenant"}
        </button>
      </div>
    </form>
  );
}
