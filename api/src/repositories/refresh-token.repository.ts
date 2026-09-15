import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { withInjectedTenant } from '../lib/tenant-injected-input.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CreateRefreshTokenInput {
  userId: string;
  familyId: string;
  tokenHash: string;
  createdByIp?: string;
}

/** Precisa rodar dentro de runWithTenant(tenantId, ...). */
export function createRefreshToken(input: CreateRefreshTokenInput) {
  return prisma.refreshToken.create({
    data: withInjectedTenant<Prisma.RefreshTokenUncheckedCreateInput>({
      userId: input.userId,
      familyId: input.familyId,
      tokenHash: input.tokenHash,
      createdByIp: input.createdByIp,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    }),
  });
}

export function revokeRefreshToken(id: string, replacedBy?: string) {
  return prisma.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date(), replacedBy },
  });
}

/** Detecção de roubo: token de uma família já revogada foi reapresentado. */
export function revokeRefreshTokenFamily(familyId: string) {
  return prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Usado na redefinição de senha: derruba todas as sessões do usuário. */
export function revokeAllRefreshTokensForUser(userId: string) {
  return prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
