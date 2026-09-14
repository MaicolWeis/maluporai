import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { withInjectedTenant } from '../lib/tenant-injected-input.js';

interface CreateAdminUserInput {
  nome: string;
  email: string;
  senhaHash: string;
}

/** Precisa rodar dentro de runWithTenant(tenantId, ...). */
export function createAdminUser(input: CreateAdminUserInput) {
  return prisma.user.create({
    data: withInjectedTenant<Prisma.UserUncheckedCreateInput>({
      nome: input.nome,
      email: input.email,
      senhaHash: input.senhaHash,
      papel: 'admin',
      status: 'ativo',
    }),
  });
}

export function findUserById(id: string) {
  return prisma.user.findUniqueOrThrow({ where: { id } });
}

export function touchLastLogin(id: string) {
  return prisma.user.update({ where: { id }, data: { ultimoLoginAt: new Date() } });
}

export function updatePasswordHash(id: string, senhaHash: string) {
  return prisma.user.update({ where: { id }, data: { senhaHash } });
}
