-- P11 — hardening e LGPD.
-- Aplicar com a role de ADMIN (dona das tabelas).

-- 1. Aceite dos termos de uso no signup (versão + momento do aceite).
ALTER TABLE users ADD COLUMN termos_versao TEXT;
ALTER TABLE users ADD COLUMN termos_aceitos_em TIMESTAMPTZ;

-- 2. Capacidade da viagem garantida no banco (dívida técnica registrada no P7).
--    A checagem da aplicação é check-then-insert: duas inscrições simultâneas
--    poderiam passar juntas. O trigger trava a linha da viagem (FOR UPDATE)
--    dentro da mesma transação do INSERT/UPDATE, serializando inscrições
--    concorrentes da mesma viagem, e recalcula a ocupação já com o lock.
--    Roda com os privilégios de quem insere (app_user), então o RLS continua
--    valendo: só enxerga inscrições do próprio tenant.
CREATE OR REPLACE FUNCTION inscricoes_checar_capacidade() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  cap INTEGER;
  ocupadas INTEGER;
BEGIN
  IF NEW.status <> 'confirmada' THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE, só checa quando a inscrição passa a ocupar mais vagas.
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'confirmada'
     AND NOT (NEW.leva_acompanhante AND NOT OLD.leva_acompanhante) THEN
    RETURN NEW;
  END IF;

  SELECT capacidade INTO cap FROM viagens WHERE id = NEW.viagem_id FOR UPDATE;

  SELECT COALESCE(SUM(1 + CASE WHEN leva_acompanhante THEN 1 ELSE 0 END), 0)
    INTO ocupadas
    FROM inscricoes
   WHERE viagem_id = NEW.viagem_id
     AND status = 'confirmada'
     AND id <> NEW.id;

  IF ocupadas + 1 + (CASE WHEN NEW.leva_acompanhante THEN 1 ELSE 0 END) > cap THEN
    RAISE EXCEPTION 'CAPACIDADE_EXCEDIDA' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER inscricoes_capacidade
  BEFORE INSERT OR UPDATE ON inscricoes
  FOR EACH ROW EXECUTE FUNCTION inscricoes_checar_capacidade();
