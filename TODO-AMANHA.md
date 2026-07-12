# TODO — Fechar a integração Mercado Pago Brasil

Estado do código: multi-país (AR/BR) já no `main` — assinatura em BRL, OAuth por
país e split. O que resta é **configuração/validação** (fora do código).

_Última atualização: credenciais e webhook BR configurados._

---

## ✅ Concluído

- **Credenciais BR no `.env.local` + Vercel (Production).** As 5 variáveis
  (`NEXT_PUBLIC_MP_CLIENT_ID_BR`, `MP_CLIENT_SECRET_BR`, `MP_WEBHOOK_SECRET_BR`,
  `NEXT_PUBLIC_MP_PUBLIC_KEY_BR`, `MP_ACCESS_TOKEN_BR`) estão gravadas localmente
  e no Vercel (Production), com **redeploy já feito** — no ar.
  - OAuth (`CLIENT_ID`/`CLIENT_SECRET`): **credenciais de produção**.
  - Assinatura (`ACCESS_TOKEN`/`PUBLIC_KEY`): ainda **teste/sandbox** (por opção).
- **Webhook cadastrado no painel da app MP Brasil** apontando para
  `https://orcamento-saas-phillbrar.vercel.app/api/mp/webhook`, com a
  "Assinatura secreta" gerada e configurada em `MP_WEBHOOK_SECRET_BR`.

---

## ⏳ Falta fazer (na ordem)

### 1. Rodar a migração no Supabase (produção) — BLOQUEADOR

Aplicar `supabase-tokens-onboarding.sql` no banco de produção.

- Adiciona a coluna `onboarding_tokens.pais` (default `'AR'`, check `AR|BR`).
- Migração **idempotente** (`add column if not exists`) — segura, não altera
  dados existentes.
- **Por que é bloqueador:** sem essa coluna, quando uma assinatura BR é aprovada
  o webhook falha ao gravar o país no token de onboarding → a conta **não é
  provisionada** (cliente paga e não recebe acesso). É o único item que ainda
  trava o fluxo de **assinatura** BR ponta a ponta.

### 2. Validar manualmente OAuth + split com usuários de teste MP

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

### 3. Trocar assinatura para credenciais de PRODUÇÃO (antes de cobrar de verdade)

Enquanto `MP_ACCESS_TOKEN_BR` e `NEXT_PUBLIC_MP_PUBLIC_KEY_BR` forem de
teste/sandbox, a cobrança da assinatura BR **não movimenta dinheiro real**.

- Você já tem o Access Token e a Public Key de **produção** da app BR em mãos
  (por opção, mantendo sandbox por enquanto).
- Quando for cobrar de verdade: substituir as duas **no `.env.local` e no Vercel
  (Production)** e **redeployar** (lembrar: `NEXT_PUBLIC_MP_PUBLIC_KEY_BR` é
  embutida no build). As credenciais OAuth (item concluído) já são as definitivas
  e **não** mudam.

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
