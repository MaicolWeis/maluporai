-- Status do cliente: ativo (padrão), inativo (parou de viajar; segue
-- inscrevível) e bloqueado (não pode receber novas inscrições).
CREATE TYPE cliente_status AS ENUM ('ativo', 'inativo', 'bloqueado');
ALTER TABLE clientes ADD COLUMN status cliente_status NOT NULL DEFAULT 'ativo';
ALTER TABLE clientes ADD COLUMN motivo_bloqueio VARCHAR(300);
CREATE INDEX clientes_tenant_status_idx ON clientes (tenant_id, status);
