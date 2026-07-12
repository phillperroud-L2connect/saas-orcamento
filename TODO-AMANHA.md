# TODO — Fechar a integração Mercado Pago Brasil

Estado do código: multi-país (AR/BR) já no `main` — assinatura em BRL, OAuth por
país e split. O que resta é **validação manual** (fora do código) + a tarefa nova
de detecção de país por IP.

_Última atualização (2026-07-12): migração Supabase aplicada em produção,
credenciais de PRODUÇÃO da assinatura BR ativas no Vercel com redeploy feito, e
detecção automática de país por IP implementada no middleware._

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
- **Detecção automática de país por IP (middleware).** No checkout público de
  plano, o `middleware.ts` lê o header `x-vercel-ip-country` (grátis na Vercel) e
  define o idioma de PARTIDA: BR → pt/BRL/credenciais MP Brasil; qualquer outro
  país → es/ARS (fluxo padrão AR). **Sem trava:** a precedência é `?lang=`
  explícito › cookie de preferência (`pref_idioma`, lembra a última escolha) ›
  país do IP. O `?lang=` (link do site institucional ou troca manual) sempre
  vence e é memorizado no cookie — nenhuma alteração no site institucional
  (WordPress/Elementor) é necessária. A lógica reaproveita a fonte única
  `lib/mp-paises.js` (nova função pura `idiomaPorPaisIp`, coberta por 3 testes) e
  é fail-open (qualquer erro/ambiente sem o header segue sem redirecionar). Vale
  tanto para quem chega direto no domínio quanto via botão "Assinar".

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

## ✅ Detecção de país por IP — CONCLUÍDA (ver detalhes em "Concluído" acima)

Implementada no `middleware.ts` (`tratarIdiomaCheckout`) + `lib/mp-paises.js`
(`idiomaPorPaisIp`, pura e testada). Resumo dos requisitos atendidos:

- ✅ Middleware Vercel lendo `x-vercel-ip-country` (sem custo/config externa).
- ✅ BR → pt/BRL/credenciais MP Brasil; outro país → es/ARS (fluxo padrão AR).
- ✅ Sem trava: `?lang=` explícito › cookie `pref_idioma` › IP. Troca manual
  sempre vence e é lembrada no cookie (1 ano).
- ✅ Vale para acesso direto ao domínio e via botão "Assinar" do site
  institucional, sem editar o WordPress/Elementor.
- ✅ Fail-open com try/catch + logging; sem loop de redirect (após anexar o
  `?lang=` o pedido vira explícito); `/checkout/sucesso` fica de fora.

Validação manual sugerida (opcional): abrir o checkout a partir de um IP BR e de
um IP não-BR (VPN) e confirmar o idioma/moeda de partida, depois trocar o
`?lang=` na mão e confirmar que a escolha persiste.
