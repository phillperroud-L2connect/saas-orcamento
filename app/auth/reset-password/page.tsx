"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

type Status = "verificando" | "pronto" | "invalido" | "concluido";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("verificando");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O link do e-mail traz um `code` (fluxo PKCE) que precisa ser trocado por
  // uma sessão de recuperação antes de permitir definir a nova senha.
  useEffect(() => {
    const supabase = createClient();

    async function estabelecerSessao() {
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        setStatus(error ? "invalido" : "pronto");
        return;
      }

      const { data } = await supabase.auth.getSession();
      setStatus(data.session ? "pronto" : "invalido");
    }

    estabelecerSessao();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }

    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });

    if (error) {
      setErro("Não foi possível alterar a senha. Solicite um novo link.");
      setCarregando(false);
      return;
    }

    // Encerra a sessão de recuperação e envia para o login com a nova senha.
    await supabase.auth.signOut();
    setStatus("concluido");
    setTimeout(() => {
      window.location.href = "/login";
    }, 2000);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Nova senha
        </h1>

        {status === "verificando" && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Validando o link...
          </p>
        )}

        {status === "invalido" && (
          <>
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              Link inválido ou expirado. Solicite um novo link de recuperação.
            </p>
            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              <Link
                href="/auth/forgot-password"
                className="font-medium text-gray-900 underline-offset-2 hover:underline dark:text-gray-100"
              >
                Pedir novo link
              </Link>
            </p>
          </>
        )}

        {status === "concluido" && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            Senha alterada com sucesso! Redirecionando para o login...
          </p>
        )}

        {status === "pronto" && (
          <>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Defina uma nova senha para sua conta.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="senha"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  Nova senha
                </label>
                <input
                  id="senha"
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-400 dark:focus:ring-gray-400"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmar"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  Confirmar nova senha
                </label>
                <input
                  id="confirmar"
                  type="password"
                  required
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-400 dark:focus:ring-gray-400"
                  placeholder="••••••••"
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
                {carregando ? "Salvando..." : "Redefinir senha"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
