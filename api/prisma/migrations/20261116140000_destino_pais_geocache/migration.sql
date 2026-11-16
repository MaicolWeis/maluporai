-- Mapa de clientes e destinos.
-- Aplicar com a role de ADMIN (dona das tabelas).

-- 1. País de destino (ISO 3166-1 alfa-2). Viagens existentes ficam no Brasil.
--    Fora do Brasil a "UF" vira estado/província opcional e livre.
ALTER TABLE viagens ADD COLUMN destino_pais VARCHAR(2) NOT NULL DEFAULT 'BR';
ALTER TABLE viagens ALTER COLUMN destino_uf DROP NOT NULL;
ALTER TABLE viagens ALTER COLUMN destino_uf TYPE VARCHAR(60);
ALTER TABLE viagens ADD CONSTRAINT viagens_uf_obrigatoria_no_brasil
  CHECK (destino_pais <> 'BR' OR (destino_uf IS NOT NULL AND char_length(destino_uf) = 2));

-- 2. Cache de coordenadas por cidade. Compartilhado entre empresas: guarda só
--    "cidade|estado|país" → lat/lng (dado público, nada pessoal), por isso não
--    tem tenant_id nem RLS. encontrado=false evita repetir buscas sem resultado.
CREATE TABLE geocache (
  chave       TEXT PRIMARY KEY,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  encontrado  BOOLEAN NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON geocache TO app_user;
