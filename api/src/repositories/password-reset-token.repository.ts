import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { withInjectedTenant } from '../lib/tenant-injected-input.js';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

interface CreateResetTokenInput {
  userId: string;
  tokenHash: string;
}

/** Precisa rodar dentro de runWithTenant(tenantId, ...). */
export function createPasswordResetToken(input: CreateResetTokenInput) {
  return prisma.passwordResetToken.create({
    data: withInjectedTenant<Prisma.PasswordResetTokenUncheckedCreateInput>({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    }),
  });
}

export function markPasswordResetTokenUsed(id: string) {
  return prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
}
