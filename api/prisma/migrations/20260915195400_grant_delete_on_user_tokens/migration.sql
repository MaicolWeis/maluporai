-- DELETE nas 3 tabelas de token, só para permitir o CASCADE da migração
-- anterior funcionar (no Postgres, quem apaga a linha pai precisa também
-- de DELETE nas tabelas filhas que cascateiam). Continua não sendo usado
-- diretamente pela aplicação: revogação de token é sempre via UPDATE
-- (revoked_at/used_at); a única forma de uma linha aqui ser fisicamente
-- apagada é como efeito colateral de DELETE /usuarios/:id (só permitido
-- para quem nunca logou — ver services/usuarios.service.ts).
GRANT DELETE ON refresh_tokens TO app_user;
GRANT DELETE ON password_reset_tokens TO app_user;
GRANT DELETE ON activation_tokens TO app_user;
