-- País do cliente (ISO-2, padrão Brasil). Fora do Brasil a "UF" vira
-- estado/província livre. No Brasil, quando informada, continua com 2 letras.
ALTER TABLE clientes ADD COLUMN pais VARCHAR(2) NOT NULL DEFAULT 'BR';
ALTER TABLE clientes ALTER COLUMN uf TYPE VARCHAR(60);
ALTER TABLE clientes ADD CONSTRAINT clientes_uf_brasil
  CHECK (pais <> 'BR' OR uf IS NULL OR char_length(uf) = 2);
