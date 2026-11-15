import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { withInjectedTenant } from '../lib/tenant-injected-input.js';

export function listDespesasPorViagem(viagemId: string) {
  return prisma.despesa.findMany({
    where: { viagemId },
    orderBy: [{ dataDespesa: 'asc' }, { createdAt: 'asc' }],
  });
}

export function findDespesaByIdOrNull(id: string) {
  return prisma.despesa.findUnique({ where: { id } });
}

interface DespesaInput {
  categoria: string;
  descricao: string;
  valor: number;
  dataDespesa: Date;
}

export function createDespesa(viagemId: string, input: DespesaInput) {
  return prisma.despesa.create({
    data: withInjectedTenant<Prisma.DespesaUncheckedCreateInput>({ ...input, viagemId }),
  });
}

export function updateDespesa(id: string, input: Partial<DespesaInput>) {
  return prisma.despesa.update({ where: { id }, data: input });
}

export function deleteDespesa(id: string) {
  return prisma.despesa.delete({ where: { id } });
}
