-- Moto do cliente (motoclubes / viagens de moto): marca e modelo, opcionais.
ALTER TABLE clientes ADD COLUMN moto_marca VARCHAR(60);
ALTER TABLE clientes ADD COLUMN moto_modelo VARCHAR(80);
