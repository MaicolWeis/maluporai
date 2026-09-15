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
