# TODO — Fechar a integração Mercado Pago Brasil

Estado atual: o código multi-país (AR/BR) já está no `main` — assinatura em BRL,
OAuth por país e split. Faltam passos de **configuração/validação** (fora do
código) para o fluxo BR ficar 100% operacional. Execute **na ordem abaixo** —
cada passo depende dos anteriores.

---

## 1. Rodar a migração no Supabase (produção)

Aplicar `supabase-tokens-onboarding.sql` no banco de produção.

- Adiciona a coluna `onboarding_tokens.pais` (default `'AR'`, check `AR|BR`).
- Migração **idempotente** (`add column if not exists`) — segura em bancos que
  já têm a tabela; não altera dados existentes.
- Sem isso, o provisionamento pós-pagamento de contas BR falha ao gravar o país
  no token de onboarding.

## 2. Preencher as credenciais BR no `.env.local` (e no ambiente da Vercel)

As chaves de **assinatura** BR (Public Key + Access Token de teste) já estão no
`.env.local`. Faltam as de **OAuth** e a do **webhook**, hoje vazias:

- `NEXT_PUBLIC_MP_CLIENT_ID_BR` — App ID da aplicação MP Brasil.
- `MP_CLIENT_SECRET_BR` — Chave secreta da MESMA aplicação BR.
- `MP_WEBHOOK_SECRET_BR` — "Assinatura secreta" do webhook da app BR.

> Lembrar de replicar essas variáveis nas **Environment Variables da Vercel**
> (produção/preview), não só no `.env.local` local.

## 3. Cadastrar a notification URL (webhook) no painel da aplicação MP Brasil

No painel da app BR → **Webhooks**, apontar para:

```
https://<dominio-producao>/api/mp/webhook
```

- **Crítico:** sem o webhook configurado + `MP_WEBHOOK_SECRET_BR` preenchido
  (passo 2), a notificação de uma **assinatura BR aprovada** é rejeitada com
  **401** e a conta **não é provisionada** (o cliente paga e não recebe acesso).
- O código já anexa `?pais=BR` à notification_url ao criar a preferência, então
  o webhook escolhe a gaveta/secret certos automaticamente.

## 4. Validar manualmente OAuth + split com usuários de teste MP

Exige clique real no navegador (login do vendedor de teste na tela do MP) —
não dá para automatizar headless. Com **usuários de teste** (vendedor e
comprador) criados no painel MP Brasil:

1. Logar como um tenant BR → **Configurações → "Conectar Mercado Pago"** →
   autorizar com o **vendedor de teste** → confirmar que `mp_access_token` é
   gravado no tenant.
2. Gerar um orçamento e abrir o link público de pagamento.
3. Pagar como **comprador de teste** → confirmar que:
   - o `webhook-orcamento` valida a assinatura (secret BR) e retorna 200;
   - o orçamento vira `aprovado` e o pagamento entra em `public.pagamentos`;
   - o dinheiro cai na conta do **vendedor de teste** (split).

---

## 5. NOVA TAREFA — Detecção de país por IP (ainda não iniciada)

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
- Direcionar o botão **"Assinar"** para o checkout do país correto — ou seja,
  montar o link com o `?lang=` certo (pt→BR / es→AR), que o sistema já usa para
  escolher gaveta de credenciais e moeda.
- Cuidados: fallback seguro quando o país do IP for desconhecido/indisponível;
  não quebrar o SEO/SSR; evitar loop de redirecionamento no middleware.

> Contexto de implementação: o mapeamento idioma↔país já existe em
> `lib/mp-paises.js` (`paisDoIdioma`); o checkout já lê `?lang=` para decidir
> AR/BR. A tarefa é só a camada de **detecção + roteamento** por cima disso.
