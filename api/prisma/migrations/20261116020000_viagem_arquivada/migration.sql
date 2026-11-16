-- Status "arquivada": viagem que já aconteceu (concluída) e sai da visão
-- geral e da listagem padrão. Reversível (arquivada → concluída).
ALTER TYPE viagem_status ADD VALUE IF NOT EXISTS 'arquivada';
