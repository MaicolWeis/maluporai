import type { AuditAcao, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { withInjectedTenant } from '../lib/tenant-injected-input.js';

interface RecordAuditLogInput {
  acao: AuditAcao;
  entidade: string;
  entidadeId?: string;
  userId?: string;
  ip?: string;
  dadosDepois?: Prisma.InputJsonValue;
}

/** Precisa rodar dentro de runWithTenant(tenantId, ...). */
export function recordAuditLog(input: RecordAuditLogInput) {
  return prisma.auditLog.create({
    data: withInjectedTenant<Prisma.AuditLogUncheckedCreateInput>({
      acao: input.acao,
      entidade: input.entidade,
      entidadeId: input.entidadeId,
      userId: input.userId,
      ip: input.ip,
      dadosDepois: input.dadosDepois,
    }),
  });
}
