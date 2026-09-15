import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { withInjectedTenant } from '../lib/tenant-injected-input.js';

interface CreateTenantInput {
  id: string;
  nomeFantasia: string;
  documento: string;
  emailContato: string;
}

const FORMAS_PAGAMENTO_DEFAULT = ['Pix', 'Cartão', 'Dinheiro', 'Transferência'];
const CATEGORIAS_DESPESA_DEFAULT = ['Hotel', 'Ingressos', 'Seguro', 'Alimentação', 'Apoio/Transporte', 'Outros'];

/** Precisa rodar dentro de runWithTenant(input.id, ...) — ver auth.service.ts. */
export function createTenant(input: CreateTenantInput) {
  return prisma.tenant.create({ data: input });
}

export function createDefaultTenantSettings() {
  return prisma.tenantSettings.create({
    data: withInjectedTenant<Prisma.TenantSettingsUncheckedCreateInput>({
      formasPagamento: FORMAS_PAGAMENTO_DEFAULT,
      categoriasDespesa: CATEGORIAS_DESPESA_DEFAULT,
    }),
  });
}

/**
 * Usado só na compensação de um signup que falhou depois do tenant já ter
 * sido criado. app_user não tem DELETE em tenants (nenhuma feature apaga
 * tenant), então marcamos como cancelado em vez de tentar remover.
 */
export function markTenantCancelada(tenantId: string) {
  return prisma.tenant.update({ where: { id: tenantId }, data: { status: 'cancelado' } });
}

/**
 * Duas queries separadas de propósito: Tenant é isento da checagem de
 * tenant (não tem tenant_id, não passa pelo SET LOCAL da extensão — ver
 * TENANT_EXEMPT_MODELS em lib/prisma.ts). Um único findUnique com
 * `include: { settings: true }` despacha como UMA operação de modelo
 * 'Tenant' — a extensão vê o modelo isento e pula o SET LOCAL pra query
 * inteira, inclusive pro include, e TenantSettings TEM RLS: a relação
 * sempre voltaria vazia. Buscando tenantSettings à parte, como operação
 * própria, ela passa pela extensão normalmente usando o contexto
 * ambiente (já setado pelo tenantContext middleware).
 */
export async function findTenantWithSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  return { ...tenant, settings };
}

interface UpdateTenantEmpresaInput {
  nomeFantasia?: string;
  razaoSocial?: string | null;
  documento?: string;
  emailContato?: string;
  telefone?: string | null;
}

/**
 * Update parcial: só os campos presentes em `input` entram no PATCH do
 * Prisma — campos não enviados nunca são tocados (nunca viram null).
 * tenantId vem sempre de req.auth (JWT), nunca do client — tenants não
 * tem RLS (ver P1), então esse `where` é a única fronteira de isolamento.
 */
export function updateTenantEmpresa(tenantId: string, input: UpdateTenantEmpresaInput) {
  return prisma.tenant.update({ where: { id: tenantId }, data: input });
}

interface UpdateTenantPreferenciasInput {
  logoUrl?: string | null;
  corPrimaria?: string | null;
  formasPagamento?: string[];
  categoriasDespesa?: string[];
  textoTermoInscricao?: string | null;
  prazoRetencaoDadosMeses?: number;
}

export function updateTenantPreferencias(tenantId: string, input: UpdateTenantPreferenciasInput) {
  return prisma.tenantSettings.update({ where: { tenantId }, data: input });
}
