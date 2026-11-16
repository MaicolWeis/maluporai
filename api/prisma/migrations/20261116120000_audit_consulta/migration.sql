-- Registro de consulta (leitura) da ficha de cliente na trilha de auditoria.
ALTER TYPE audit_acao ADD VALUE IF NOT EXISTS 'consulta';
