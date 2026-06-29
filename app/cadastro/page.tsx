"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-400 dark:focus:ring-gray-400";

const LABEL_CLASS =
  "block text-sm font-medium text-gray-700 dark:text-gray-200";

export default function CadastroPage() {
  return (
    <Suspense fallback={<Casca />}>
      <CadastroConteudo />
    </Suspense>
  );
}

/** Moldura padrão (usada como fallback do Suspense e pelos estados internos). */
function Casca({ children }: { children?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {children}
      </div>
    </main>
  );
}

type EstadoToken = "validando" | "valido" | "invalido";

const PLANO_LABEL: Record<string, string> = {
  basico: "Básico",
  pro: "Pró",
};

function CadastroConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // --- Modo token (onboarding pós-pagamento) -------------------------------
  const [estadoToken, setEstadoToken] = useState<EstadoToken>(
    token ? "validando" : "valido",
  );
  const [planoToken, setPlanoToken] = useState<string | null>(null);
  const [confirmarSenha, setConfirmarSenha] = useState("");

  // --- Campos do formulário ------------------------------------------------
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Valida o token assim que a página carrega (se houver).
  useEffect(() => {
    if (!token) return;
    let ativo = true;

    (async () => {
      try {
        const res = await fetch(
          `/api/cadastro/token?token=${encodeURIComponent(token)}`,
        );
        const data = await res.json();
        if (!ativo) return;

        if (data.valido) {
          setEmail(data.email);
          setPlanoToken(data.plano);
          setEstadoToken("valido");
        } else {
          setEstadoToken("invalido");
        }
      } catch {
        if (ativo) setEstadoToken("invalido");
      }
    })();

    return () => {
      ativo = false;
    };
  }, [token]);

  // Cadastro público (sem token): fluxo original.
  async function handleSubmitPublico(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    });

    if (error) {
      setErro(error.message);
      setCarregando(false);
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setSucesso("Cadastro realizado! Verifique seu e-mail para confirmar a conta.");
    setCarregando(false);
  }

  // Cadastro por token: cria a conta no servidor e faz login automático.
  async function handleSubmitToken(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    if (senha.length < 6) {
      setErro("La contraseña debe tener al menos 6 caracteres.");
      setCarregando(false);
      return;
    }
    if (senha !== confirmarSenha) {
      setErro("Las contraseñas no coinciden.");
      setCarregando(false);
      return;
    }

    const res = await fetch("/api/cadastro/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, senha }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        data?.erro === "ja_cadastrado"
          ? "Esta cuenta ya fue activada. Probá iniciar sesión."
          : data?.erro === "expirado" || data?.erro === "usado" || data?.erro === "invalido"
            ? "El enlace ya no es válido. Solicitá uno nuevo a soporte."
            : "No pudimos crear tu cuenta. Intentá de nuevo en unos minutos.";
      setErro(msg);
      setCarregando(false);
      return;
    }

    // Conta criada no servidor: estabelece a sessão no browser e entra.
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      // Conta existe, mas o login falhou — manda para o login manual.
      router.push("/login");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  // --- Estado: validando o token -------------------------------------------
  if (token && estadoToken === "validando") {
    return (
      <Casca>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Validando tu enlace…
        </p>
      </Casca>
    );
  }

  // --- Estado: token inválido / expirado / usado ---------------------------
  if (token && estadoToken === "invalido") {
    return (
      <Casca>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Enlace no válido
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Este enlace de activación expiró o ya fue utilizado. Escribinos y te
          enviamos uno nuevo.
        </p>
        <a
          href="mailto:philip@l2connect.com.br"
          className="mt-6 block w-full rounded-lg bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          Contactar a soporte
        </a>
        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          ¿Ya tenés cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-gray-900 underline-offset-2 hover:underline dark:text-gray-100"
          >
            Iniciar sesión
          </Link>
        </p>
      </Casca>
    );
  }

  // --- Estado: token válido → definir senha --------------------------------
  if (token) {
    return (
      <Casca>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Activá tu cuenta
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Plan <strong>{PLANO_LABEL[planoToken ?? ""] ?? planoToken}</strong>{" "}
          confirmado. Creá tu contraseña para entrar.
        </p>

        <form onSubmit={handleSubmitToken} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className={LABEL_CLASS}>
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              disabled
              readOnly
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="senha" className={LABEL_CLASS}>
              Contraseña
            </label>
            <input
              id="senha"
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label htmlFor="confirmar" className={LABEL_CLASS}>
              Confirmar contraseña
            </label>
            <input
              id="confirmar"
              type="password"
              required
              minLength={6}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Repetí la contraseña"
            />
          </div>

          {erro && (
            <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {carregando ? "Creando cuenta…" : "Crear mi contraseña"}
          </button>
        </form>
      </Casca>
    );
  }

  // --- Cadastro público (sem token): fluxo original ------------------------
  return (
    <Casca>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Criar conta
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Comece a gerar seus orçamentos.
      </p>

      <form onSubmit={handleSubmitPublico} className="mt-6 space-y-4">
        <div>
          <label htmlFor="nome" className={LABEL_CLASS}>
            Nome
          </label>
          <input
            id="nome"
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Seu nome"
          />
        </div>

        <div>
          <label htmlFor="email" className={LABEL_CLASS}>
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_CLASS}
            placeholder="voce@email.com"
          />
        </div>

        <div>
          <label htmlFor="senha" className={LABEL_CLASS}>
            Senha
          </label>
          <input
            id="senha"
            type="password"
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
        {sucesso && (
          <p className="text-sm text-green-600 dark:text-green-400">{sucesso}</p>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {carregando ? "Criando conta..." : "Cadastrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Já tem conta?{" "}
        <Link
          href="/login"
          className="font-medium text-gray-900 underline-offset-2 hover:underline dark:text-gray-100"
        >
          Entrar
        </Link>
      </p>
    </Casca>
  );
}
