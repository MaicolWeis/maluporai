-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('ativo', 'suspenso', 'cancelado');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'operador');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ativo', 'inativo', 'convidado');

-- CreateEnum
CREATE TYPE "viagem_status" AS ENUM ('planejamento', 'inscricoes', 'confirmada', 'concluida', 'cancelada');

-- CreateEnum
CREATE TYPE "atracao_tipo" AS ENUM ('parque', 'passeio', 'refeicao', 'outro');

-- CreateEnum
CREATE TYPE "inscricao_status" AS ENUM ('confirmada', 'cancelada', 'lista_espera');

-- CreateEnum
CREATE TYPE "pagamento_forma" AS ENUM ('pix', 'cartao', 'dinheiro', 'transferencia');

-- CreateEnum
CREATE TYPE "audit_acao" AS ENUM ('create', 'update', 'delete', 'login', 'export', 'anonimizacao');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome_fantasia" TEXT NOT NULL,
    "razao_social" TEXT,
    "documento" TEXT NOT NULL,
    "email_contato" TEXT NOT NULL,
    "telefone" TEXT,
    "plano" TEXT NOT NULL DEFAULT 'free',
    "status" "tenant_status" NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" "user_role" NOT NULL DEFAULT 'operador',
    "status" "user_status" NOT NULL DEFAULT 'ativo',
    "ultimo_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "logo_url" TEXT,
    "cor_primaria" TEXT,
    "formas_pagamento" JSONB NOT NULL,
    "categorias_despesa" JSONB NOT NULL,
    "texto_termo_inscricao" TEXT,
    "prazo_retencao_dados_meses" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "cpf_hash" VARCHAR(64),
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "cidade" TEXT,
    "uf" VARCHAR(2),
    "data_nascimento" DATE,
    "contato_emergencia_nome" TEXT,
    "contato_emergencia_telefone" TEXT,
    "observacoes" TEXT,
    "consentimento_marketing" BOOLEAN NOT NULL DEFAULT false,
    "consentimento_em" TIMESTAMP(3),
    "anonimizado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viagens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "destino_cidade" TEXT NOT NULL,
    "destino_uf" VARCHAR(2) NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "capacidade" INTEGER NOT NULL,
    "preco_titular" DECIMAL(10,2) NOT NULL,
    "preco_acompanhante" DECIMAL(10,2),
    "status" "viagem_status" NOT NULL DEFAULT 'planejamento',
    "descricao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "viagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viagem_hoteis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "viagem_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cidade" TEXT,
    "telefone" TEXT,
    "check_in" DATE,
    "check_out" DATE,
    "valor_negociado" DECIMAL(10,2),
    "observacoes" TEXT,

    CONSTRAINT "viagem_hoteis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viagem_atracoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "viagem_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "atracao_tipo" NOT NULL,
    "valor_entrada" DECIMAL(10,2),
    "incluso" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,

    CONSTRAINT "viagem_atracoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viagem_inclusos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "viagem_id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "viagem_inclusos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscricoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "viagem_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "leva_acompanhante" BOOLEAN NOT NULL DEFAULT false,
    "nome_acompanhante" TEXT,
    "doc_acompanhante" TEXT,
    "seguro_viagem" BOOLEAN NOT NULL DEFAULT false,
    "seguradora" TEXT,
    "numero_apolice" TEXT,
    "valor_total" DECIMAL(10,2) NOT NULL,
    "status" "inscricao_status" NOT NULL DEFAULT 'confirmada',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inscricoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "inscricao_id" UUID NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "forma" "pagamento_forma" NOT NULL,
    "parcelas" INTEGER,
    "data_pagamento" DATE NOT NULL,
    "comprovante_url" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "despesas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "viagem_id" UUID NOT NULL,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data_despesa" DATE NOT NULL,
    "comprovante_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "despesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "acao" "audit_acao" NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT,
    "dados_antes" JSONB,
    "dados_depois" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenant_id_key" ON "tenant_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_settings_tenant_id_idx" ON "tenant_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "clientes_tenant_id_idx" ON "clientes"("tenant_id");

-- CreateIndex
CREATE INDEX "clientes_tenant_id_cpf_hash_idx" ON "clientes"("tenant_id", "cpf_hash");

-- CreateIndex
CREATE INDEX "viagens_tenant_id_idx" ON "viagens"("tenant_id");

-- CreateIndex
CREATE INDEX "viagem_hoteis_tenant_id_idx" ON "viagem_hoteis"("tenant_id");

-- CreateIndex
CREATE INDEX "viagem_hoteis_viagem_id_idx" ON "viagem_hoteis"("viagem_id");

-- CreateIndex
CREATE INDEX "viagem_atracoes_tenant_id_idx" ON "viagem_atracoes"("tenant_id");

-- CreateIndex
CREATE INDEX "viagem_atracoes_viagem_id_idx" ON "viagem_atracoes"("viagem_id");

-- CreateIndex
CREATE INDEX "viagem_inclusos_tenant_id_idx" ON "viagem_inclusos"("tenant_id");

-- CreateIndex
CREATE INDEX "viagem_inclusos_viagem_id_idx" ON "viagem_inclusos"("viagem_id");

-- CreateIndex
CREATE INDEX "inscricoes_tenant_id_idx" ON "inscricoes"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "inscricoes_viagem_id_cliente_id_key" ON "inscricoes"("viagem_id", "cliente_id");

-- CreateIndex
CREATE INDEX "pagamentos_tenant_id_idx" ON "pagamentos"("tenant_id");

-- CreateIndex
CREATE INDEX "pagamentos_inscricao_id_idx" ON "pagamentos"("inscricao_id");

-- CreateIndex
CREATE INDEX "despesas_tenant_id_idx" ON "despesas"("tenant_id");

-- CreateIndex
CREATE INDEX "despesas_viagem_id_idx" ON "despesas"("viagem_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viagens" ADD CONSTRAINT "viagens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viagem_hoteis" ADD CONSTRAINT "viagem_hoteis_viagem_id_fkey" FOREIGN KEY ("viagem_id") REFERENCES "viagens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viagem_atracoes" ADD CONSTRAINT "viagem_atracoes_viagem_id_fkey" FOREIGN KEY ("viagem_id") REFERENCES "viagens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viagem_inclusos" ADD CONSTRAINT "viagem_inclusos_viagem_id_fkey" FOREIGN KEY ("viagem_id") REFERENCES "viagens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_viagem_id_fkey" FOREIGN KEY ("viagem_id") REFERENCES "viagens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_inscricao_id_fkey" FOREIGN KEY ("inscricao_id") REFERENCES "inscricoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_viagem_id_fkey" FOREIGN KEY ("viagem_id") REFERENCES "viagens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
