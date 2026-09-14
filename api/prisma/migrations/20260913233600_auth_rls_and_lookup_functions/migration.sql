-- RLS para as tabelas de token de autenticação (mesmo padrão do P1) +
-- funções de bootstrap de login/refresh/reset.
--
-- Aplicar sempre com a role de ADMIN (dona das tabelas), nunca com app_user.

-- 1. RLS + policy tenant_isolation, igual às tabelas de negócio do P1.
DO $$
DECLARE
  tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['refresh_tokens', 'password_reset_tokens']
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

-- app_user não precisa apagar tokens (revogação é feita com UPDATE
-- revoked_at/used_at, preservando o histórico para auditoria/depuração).
GRANT SELECT, INSERT, UPDATE ON refresh_tokens TO app_user;
GRANT SELECT, INSERT, UPDATE ON password_reset_tokens TO app_user;

-- 2. Funções de bootstrap: o único jeito de descobrir o tenant_id de um
-- usuário a partir de um e-mail (globalmente único) ou de um token opaco
-- (refresh/reset), ANTES de existir tenant no contexto (AsyncLocalStorage).
-- SECURITY DEFINER roda com o dono da função (role de admin, sempre
-- superuser neste projeto), que ignora RLS — por isso cada função é
-- estritamente somente-leitura, devolve só as colunas necessárias para
-- autenticar, e o EXECUTE é revogado de PUBLIC e concedido só a app_user.
-- Nenhum outro caminho de código deve usar SECURITY DEFINER: qualquer
-- operação após a descoberta do tenant_id passa pelo caminho normal
-- (Prisma extension + RLS).

CREATE FUNCTION auth_find_user_by_email(p_email text)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  senha_hash text,
  papel user_role,
  status user_status
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT users.id, users.tenant_id, users.senha_hash, users.papel, users.status
  FROM users
  WHERE users.email = p_email;
$$;

CREATE FUNCTION auth_find_refresh_token(p_token_hash text)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  user_id uuid,
  family_id uuid,
  expires_at timestamptz,
  revoked_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT refresh_tokens.id, refresh_tokens.tenant_id, refresh_tokens.user_id,
         refresh_tokens.family_id, refresh_tokens.expires_at, refresh_tokens.revoked_at
  FROM refresh_tokens
  WHERE refresh_tokens.token_hash = p_token_hash;
$$;

CREATE FUNCTION auth_find_reset_token(p_token_hash text)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  user_id uuid,
  expires_at timestamptz,
  used_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT password_reset_tokens.id, password_reset_tokens.tenant_id, password_reset_tokens.user_id,
         password_reset_tokens.expires_at, password_reset_tokens.used_at
  FROM password_reset_tokens
  WHERE password_reset_tokens.token_hash = p_token_hash;
$$;

REVOKE ALL ON FUNCTION auth_find_user_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_find_refresh_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_find_reset_token(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION auth_find_user_by_email(text) TO app_user;
GRANT EXECUTE ON FUNCTION auth_find_refresh_token(text) TO app_user;
GRANT EXECUTE ON FUNCTION auth_find_reset_token(text) TO app_user;
