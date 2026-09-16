import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { withInjectedTenant } from '../lib/tenant-injected-input.js';

export function listPagamentosPorInscricao(inscricaoId: string) {
  return prisma.pagamento.findMany({
    where: { inscricaoId },
    orderBy: { dataPagamento: 'asc' },
  });
}

export function findPagamentoByIdOrNull(id: string) {
  return prisma.pagamento.findUnique({ where: { id } });
}

interface CreatePagamentoInput {
  valor: number;
  forma: string;
  parcelas?: number;
  dataPagamento: Date;
  observacoes?: string;
}

export function createPagamento(inscricaoId: string, input: CreatePagamentoInput) {
  return prisma.pagamento.create({
    data: withInjectedTenant<Prisma.PagamentoUncheckedCreateInput>({ ...input, inscricaoId }),
  });
}

export function deletePagamento(id: string) {
  return prisma.pagamento.delete({ where: { id } });
}
