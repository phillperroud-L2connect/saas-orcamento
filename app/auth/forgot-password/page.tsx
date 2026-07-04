"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      setErro("Não foi possível enviar o e-mail. Tente novamente.");
      setCarregando(false);
      return;
    }

    // Não revelamos se o e-mail existe (evita enumeração de contas).
    setEnviado(true);
    setCarregando(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Recuperar senha
        </h1>

        {enviado ? (
          <>
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              Se existir uma conta com esse e-mail, enviamos um link para redefinir
              a senha. Verifique sua caixa de entrada (e o spam).
            </p>
            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              <Link
                href="/login"
                className="font-medium text-gray-900 underline-offset-2 hover:underline dark:text-gray-100"
              >
                Voltar para o login
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Informe seu e-mail e enviaremos um link para redefinir sua senha.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-400 dark:focus:ring-gray-400"
                  placeholder="voce@email.com"
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
                {carregando ? "Enviando..." : "Enviar link de recuperação"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              <Link
                href="/login"
                className="font-medium text-gray-900 underline-offset-2 hover:underline dark:text-gray-100"
              >
                Voltar para o login
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
