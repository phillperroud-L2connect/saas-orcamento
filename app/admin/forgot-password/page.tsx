"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const resp = await fetch("/api/admin/recuperar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!resp.ok) throw new Error("falha");
      // Não revelamos se o e-mail é o do admin (evita enumeração).
      setEnviado(true);
    } catch {
      setErro("Não foi possível enviar o e-mail. Tente novamente.");
    } finally {
      setCarregando(false);
    }
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
          Recuperar acesso admin
        </h1>

        {enviado ? (
          <>
            <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              Se este for o e-mail do administrador, enviamos um link para
              redefinir a senha. Verifique a caixa de entrada (e o spam).
            </p>
            <p className="mt-7 text-center text-sm text-white/40">
              <Link
                href="/admin/login"
                className="font-medium text-white/70 underline-offset-2 transition hover:text-white hover:underline"
              >
                Voltar ao login
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-sm text-white/40">
              Informe o e-mail do administrador para receber o link de
              redefinição de senha.
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
                {carregando ? "Enviando..." : "Enviar link de recuperação"}
              </button>
            </form>
            <p className="mt-7 text-center text-xs text-white/30">
              <Link
                href="/admin/login"
                className="transition hover:text-white/60"
              >
                Voltar ao login
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
