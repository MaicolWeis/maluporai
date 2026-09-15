-- RLS para activation_tokens (mesmo padrão de refresh_tokens/
-- password_reset_tokens do P2) + função de bootstrap para
-- POST /auth/ativar-conta, que roda antes de existir tenant no contexto.
--
-- Aplicar sempre com a role de ADMIN (dona das tabelas), nunca com app_user.

ALTER TABLE activation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON activation_tokens
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Sem DELETE: revogação/consumo é sempre via UPDATE (used_at), preservando
-- histórico — mesmo racional das outras tabelas de token do P2.
GRANT SELECT, INSERT, UPDATE ON activation_tokens TO app_user;

CREATE FUNCTION auth_find_activation_token(p_token_hash text)
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
  SELECT activation_tokens.id, activation_tokens.tenant_id, activation_tokens.user_id,
         activation_tokens.expires_at, activation_tokens.used_at
  FROM activation_tokens
  WHERE activation_tokens.token_hash = p_token_hash;
$$;

REVOKE ALL ON FUNCTION auth_find_activation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_find_activation_token(text) TO app_user;
