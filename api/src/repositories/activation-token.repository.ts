import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { withInjectedTenant } from '../lib/tenant-injected-input.js';

const ACTIVATION_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

interface CreateActivationTokenInput {
  userId: string;
  tokenHash: string;
}

/** Precisa rodar dentro de runWithTenant(tenantId, ...). */
export function createActivationToken(input: CreateActivationTokenInput) {
  return prisma.activationToken.create({
    data: withInjectedTenant<Prisma.ActivationTokenUncheckedCreateInput>({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
    }),
  });
}

export function markActivationTokenUsed(id: string) {
  return prisma.activationToken.update({ where: { id }, data: { usedAt: new Date() } });
}
