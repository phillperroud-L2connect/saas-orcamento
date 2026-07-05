"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Status = "verificando" | "pronto" | "invalido" | "concluido";

export default function AdminResetPasswordPage() {
  const [status, setStatus] = useState<Status>("verificando");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O link do e-mail traz um `token_hash` (recovery) que estabelece a sessão de
  // recuperação via verifyOtp antes de permitir definir a nova senha.
  useEffect(() => {
    const supabase = createClient();

    async function estabelecer() {
      try {
        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get("token_hash");
        const type = params.get("type");

        if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
          });
          setStatus(error ? "invalido" : "pronto");
          return;
        }

        // Fallback: já existe uma sessão de recuperação ativa?
        const { data } = await supabase.auth.getSession();
        setStatus(data.session ? "pronto" : "invalido");
      } catch {
        setStatus("invalido");
      }
    }

    estabelecer();
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

    // Encerra a sessão de recuperação e volta ao login do admin.
    await supabase.auth.signOut();
    setStatus("concluido");
    setTimeout(() => {
      window.location.href = "/admin/login";
    }, 2000);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#0A0A0A] px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(255,255,255,0.06),transparent)]"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
          <ShieldCheck className="size-5 text-white/80" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
          Nova senha do admin
        </h1>

        {status === "verificando" && (
          <p className="mt-4 text-sm text-white/40">Validando o link...</p>
        )}

        {status === "invalido" && (
          <>
            <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              Link inválido ou expirado. Solicite um novo link de recuperação.
            </p>
            <p className="mt-7 text-center text-sm text-white/40">
              <Link
                href="/admin/forgot-password"
                className="font-medium text-white/70 underline-offset-2 transition hover:text-white hover:underline"
              >
                Pedir novo link
              </Link>
            </p>
          </>
        )}

        {status === "concluido" && (
          <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            Senha alterada com sucesso! Redirecionando para o login...
          </p>
        )}

        {status === "pronto" && (
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label
                htmlFor="senha"
                className="block text-xs font-medium uppercase tracking-wide text-white/50"
              >
                Nova senha
              </label>
              <input
                id="senha"
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/20"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label
                htmlFor="confirmar"
                className="block text-xs font-medium uppercase tracking-wide text-white/50"
              >
                Confirmar nova senha
              </label>
              <input
                id="confirmar"
                type="password"
                required
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/20"
                placeholder="••••••••"
              />
            </div>
            {erro && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {erro}
              </p>
            )}
            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-[#0A0A0A] transition hover:bg-white/90 disabled:opacity-60"
            >
              {carregando ? "Salvando..." : "Redefinir senha"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
