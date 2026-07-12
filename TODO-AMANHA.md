# TODO — Fechar a integração Mercado Pago Brasil

Estado do código: multi-país (AR/BR) já no `main` — assinatura em BRL, OAuth por
país e split. O que resta é **validação manual** (fora do código) + a tarefa nova
de detecção de país por IP.

_Última atualização (2026-07-12): migração Supabase aplicada em produção e
credenciais de PRODUÇÃO da assinatura BR ativas no Vercel com redeploy feito._

---

## ✅ Concluído

- **Credenciais BR no `.env.local` + Vercel (Production).** As 5 variáveis
  (`NEXT_PUBLIC_MP_CLIENT_ID_BR`, `MP_CLIENT_SECRET_BR`, `MP_WEBHOOK_SECRET_BR`,
  `NEXT_PUBLIC_MP_PUBLIC_KEY_BR`, `MP_ACCESS_TOKEN_BR`) estão gravadas localmente
  e no Vercel (Production), com **redeploy já feito** — no ar.
  - OAuth (`CLIENT_ID`/`CLIENT_SECRET`): **credenciais de produção**.
  - Assinatura (`ACCESS_TOKEN`/`PUBLIC_KEY`): **credenciais de produção** —
    atualizadas em 2026-07-12 (eram de um usuário de teste). Redeploy feito, então
    a `NEXT_PUBLIC_MP_PUBLIC_KEY_BR` (embutida no build) já está valendo. A
    cobrança da assinatura BR agora **movimenta dinheiro real**.
- **Webhook cadastrado no painel da app MP Brasil** apontando para
  `https://orcamento-saas-phillbrar.vercel.app/api/mp/webhook`, com a
  "Assinatura secreta" (modo produção) gerada e configurada em
  `MP_WEBHOOK_SECRET_BR`. Confirmado válido — não precisa regenerar.
- **Migração `supabase-tokens-onboarding.sql` aplicada em produção.** A coluna
  `onboarding_tokens.pais` (default `'AR'`, check `AR|BR`) existe no banco. Com
  isso o webhook de assinatura BR grava o país no token de onboarding e provisiona
  a conta ponta a ponta. Era o único bloqueador do fluxo — **destravado**.

---

## ⏳ Falta fazer

### 1. Validar manualmente OAuth + split com usuários de teste MP

Exige clique real no navegador (login do vendedor de teste na tela do MP) — não
dá para automatizar headless. Como o OAuth já usa credenciais de **produção**, a
autorização conecta contas MP reais; para testar sem mexer em conta real, use
**usuários de teste** (vendedor e comprador) do painel MP Brasil:

1. Logar como um tenant BR → **Configurações → "Conectar Mercado Pago"** →
   autorizar com o **vendedor de teste** → confirmar que `mp_access_token` é
   gravado no tenant.
2. Gerar um orçamento e abrir o link público de pagamento.
3. Pagar como **comprador de teste** → confirmar que:
   - o `webhook-orcamento` valida a assinatura (secret BR) e retorna 200;
   - o orçamento vira `aprovado` e o pagamento entra em `public.pagamentos`;
   - o dinheiro cai na conta do **vendedor de teste** (split).

### 2. Teste manual do fluxo de assinatura BR ponta a ponta

Agora que a assinatura está em produção e a migração foi aplicada, validar o
fluxo real de venda:

1. Assinar um plano com `pais=BR` (checkout em BRL).
2. Confirmar que o `/api/mp/webhook?pais=BR` recebe a notificação, valida a
   assinatura e retorna 200.
3. Confirmar que o token de onboarding é gravado com `pais='BR'` e o e-mail
   tokenizado (`/cadastro?token=...`) chega via Resend.
4. Completar o cadastro (definir senha) e confirmar que o tenant é provisionado
   com pais/idioma/moeda BR (pt/BRL).

---

## 🆕 Tarefa nova (ainda não iniciada) — Detecção de país por IP

Implementar detecção automática de país por IP, **mantendo a liberdade** do
visitante de escolher idioma/país manualmente.

Requisitos e restrições:

- Rodar como **middleware na Vercel** (`middleware.ts`), sem exigir edição do
  HTML do site institucional.
- Usar a geolocalização de borda da Vercel (`request.geo.country` /
  `x-vercel-ip-country`) para inferir AR vs BR.
- **Não travar** a escolha: a detecção define só o *default*; o visitante pode
  trocar idioma/país manualmente (persistir a preferência em cookie e priorizá-la
  sobre o IP).
- Direcionar o botão **"Assinar"** para o checkout do país correto — montar o
  link com o `?lang=` certo (pt→BR / es→AR), que o sistema já usa para escolher
  gaveta de credenciais e moeda.
- Cuidados: fallback seguro quando o país do IP for desconhecido/indisponível;
  não quebrar o SEO/SSR; evitar loop de redirecionamento no middleware.

> Contexto: o mapeamento idioma↔país já existe em `lib/mp-paises.js`
> (`paisDoIdioma`); o checkout já lê `?lang=` para decidir AR/BR. A tarefa é só a
> camada de **detecção + roteamento** por cima disso.
