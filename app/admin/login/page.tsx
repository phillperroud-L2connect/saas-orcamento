"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { isAdminUser } from "@/lib/admin";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErro("E-mail ou senha inválidos.");
      setCarregando(false);
      return;
    }

    // Login válido, mas só o dono do SaaS acessa o painel. Encerra a sessão
    // de qualquer outro usuário para não deixá-lo autenticado por engano.
    if (!isAdminUser(data.user)) {
      await supabase.auth.signOut();
      setErro("Esta conta não tem acesso ao painel administrativo.");
      setCarregando(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-4">
      {/* Atmosfera: brilho radial sutil ao fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(255,255,255,0.06),transparent)]"
      />

      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
          <ShieldCheck className="size-5 text-white/80" />
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
          Painel Administrativo
        </h1>
        <p className="mt-1.5 text-sm text-white/40">
          Acesso restrito ao administrador do sistema.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium uppercase tracking-wide text-white/50"
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/20"
              placeholder="admin@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="senha"
              className="block text-xs font-medium uppercase tracking-wide text-white/50"
            >
              Senha
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
            {carregando ? "Entrando..." : "Entrar no painel"}
          </button>
        </form>

        <p className="mt-7 text-center text-xs text-white/30">
          Gerador de Orçamento · Administração
        </p>
      </div>
    </main>
  );
}
