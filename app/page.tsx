import { redirect } from "next/navigation";

// A rota "/" é apenas a porta de entrada do app: encaminha para o login.
// O middleware (middleware.ts) já redireciona um usuário autenticado de
// /login para /dashboard, então não é preciso checar sessão aqui.
//
// IMPORTANTE: não envolver redirect() em try/catch. O Next.js implementa o
// redirect lançando um erro de controle (NEXT_REDIRECT) que o framework
// precisa capturar; um catch local engoliria esse sinal e quebraria o
// redirecionamento (a página renderizaria vazia).
export default function Home() {
  redirect("/login");
}
