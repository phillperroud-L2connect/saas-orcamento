-- =============================================================================
-- SaaS Gerador de Orçamento — Correção de tenants antigos (pt / NULL → AR/es/ARS)
-- Execute UMA VEZ no SQL Editor do Supabase. Idempotente (pode rodar de novo).
-- =============================================================================
-- Contexto: por enquanto só aceitamos clientes argentinos. Tenants criados antes
-- da correção do trigger handle_new_user (ou pelo cadastro público /cadastro)
-- podem ter nascido com idioma='pt' e/ou moeda_preferida NULL ou diferente de
-- 'ARS'. Este script normaliza esses registros para a região Argentina.
--
-- Alvo (qualquer uma das condições):
--   • idioma = 'pt'                  (cadastro caiu no default português)
--   • moeda_preferida IS NULL        (nunca recebeu moeda)
--   • moeda_preferida <> 'ARS'       (ex.: USD/BRL herdados)
--
-- Define em todos eles: pais='AR', idioma='es', moeda_preferida='ARS'.
--
-- OBS: o formulário admin permite escolher idioma/moeda manualmente. Se houver
-- algum tenant que DEVE permanecer em outro idioma/moeda, revise antes de rodar
-- ou ajuste o WHERE para excluí-lo (ex.: and email <> 'cliente@exemplo.com').
-- =============================================================================

-- 1. Pré-visualização (opcional): veja quais tenants serão afetados ANTES.
--    Descomente para conferir antes de aplicar o UPDATE.
-- select id, nome_empresa, email, pais, idioma, moeda_preferida
--   from public.tenants
--  where idioma = 'pt'
--     or moeda_preferida is null
--     or moeda_preferida <> 'ARS';

-- 2. Correção: normaliza os tenants afetados para a região Argentina.
update public.tenants
   set pais = 'AR',
       idioma = 'es',
       moeda_preferida = 'ARS'
 where idioma = 'pt'
    or moeda_preferida is null
    or moeda_preferida <> 'ARS';

-- 3. Verificação (opcional): após rodar, esta consulta deve retornar 0 linhas.
-- select id, nome_empresa, email, pais, idioma, moeda_preferida
--   from public.tenants
--  where idioma <> 'es'
--     or moeda_preferida is null
--     or moeda_preferida <> 'ARS';

-- =============================================================================
-- FIM
-- =============================================================================
