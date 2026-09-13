-- Multi-tenancy: Row Level Security + role de aplicação sem BYPASSRLS.
--
-- Esta migração precisa ser aplicada com uma role de ADMIN (dona das
-- tabelas, ex.: `postgres`). Nunca aplicar com `app_user`: ele nunca deve
-- ter privilégio de DDL nem de administrar roles.
--
-- IMPORTANTE sobre a senha abaixo: o valor é um placeholder de
-- desenvolvimento. Em produção, gire a senha logo após aplicar esta
-- migração com `ALTER ROLE app_user WITH PASSWORD '<segredo do cofre>'`
-- e nunca reutilize o placeholder.

-- 1. Role de aplicação, sem BYPASSRLS, sem privilégio de criar bancos/roles.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user
      WITH LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOBYPASSRLS
      PASSWORD 'changeme_dev_only_rotate_in_prod';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;

-- 2. Tabelas de negócio: RLS + policy tenant_isolation.
-- current_setting('app.tenant_id', true) retorna NULL quando a variável não
-- foi definida na sessão (missing_ok = true); NULLIF(..., '') evita erro de
-- cast quando o valor é string vazia. Sem app.tenant_id setado, a condição
-- vira `tenant_id = NULL`, que nunca é verdadeira: nenhuma linha é visível.
DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'users',
    'tenant_settings',
    'clientes',
    'viagens',
    'viagem_hoteis',
    'viagem_atracoes',
    'viagem_inclusos',
    'inscricoes',
    'pagamentos',
    'despesas',
    'audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tabela);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)
         WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      tabela
    );
  END LOOP;
END
$$;

-- audit_logs é escrita apenas via INSERT (nunca UPDATE/DELETE pela
-- aplicação); a policy acima cobre ALL comandos, mas a política de
-- INSERT precisa ser reafirmada isoladamente porque revogaremos o
-- privilégio de UPDATE/DELETE da role a seguir — RLS por si só permitiria
-- 0 linhas afetadas, mas o REVOKE torna a negação explícita a nível de
-- permissão (erro, não silêncio).
DROP POLICY tenant_isolation ON audit_logs;

CREATE POLICY tenant_isolation_select ON audit_logs
  FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_insert ON audit_logs
  FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 3. Grants por tabela para app_user.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  users,
  tenant_settings,
  clientes,
  viagens,
  viagem_hoteis,
  viagem_atracoes,
  viagem_inclusos,
  inscricoes,
  pagamentos,
  despesas
  TO app_user;

-- audit_logs: apenas leitura e inserção; UPDATE/DELETE nunca concedidos.
GRANT SELECT, INSERT ON audit_logs TO app_user;
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;

-- tenants: sem RLS (não tem tenant_id — é a raiz do isolamento). O
-- controle de "só posso ver o meu próprio tenant" é feito na camada de
-- aplicação (filtro por id = tenant do JWT), não pelo banco.
GRANT SELECT, INSERT, UPDATE ON tenants TO app_user;

-- Sequência do audit_logs (bigserial) precisa de USAGE para o INSERT.
GRANT USAGE, SELECT ON SEQUENCE audit_logs_id_seq TO app_user;
