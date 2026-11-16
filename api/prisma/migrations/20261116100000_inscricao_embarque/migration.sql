-- Webapp (entrega 2) — lista de embarque no dia da viagem.
-- Momento em que o guia marcou o embarque do inscrito (e do acompanhante,
-- que viaja na mesma inscrição). NULL = ainda não embarcou.
-- A política RLS da tabela já cobre a coluna nova.
ALTER TABLE inscricoes ADD COLUMN embarcado_em TIMESTAMPTZ;
