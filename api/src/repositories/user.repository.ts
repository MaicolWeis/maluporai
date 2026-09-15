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

/**
 * null quando o id não existe OU pertence a outro tenant (RLS filtra a
 * linha silenciosamente) — controller mapeia para 404, nunca 403, pra não
 * vazar a existência do recurso em outro tenant (seção 3).
 */
export function findUserByIdOrNull(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function touchLastLogin(id: string) {
  return prisma.user.update({ where: { id }, data: { ultimoLoginAt: new Date() } });
}

export function updatePasswordHash(id: string, senhaHash: string) {
  return prisma.user.update({ where: { id }, data: { senhaHash } });
}

export function listUsers() {
  return prisma.user.findMany({
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, email: true, papel: true, status: true, ultimoLoginAt: true },
  });
}

interface CreateInvitedUserInput {
  nome: string;
  email: string;
  papel: 'admin' | 'operador';
}

/** Convite: sem senha ainda (definida em /auth/ativar-conta). */
export function createInvitedUser(input: CreateInvitedUserInput) {
  return prisma.user.create({
    data: withInjectedTenant<Prisma.UserUncheckedCreateInput>({
      nome: input.nome,
      email: input.email,
      papel: input.papel,
      status: 'convidado',
    }),
  });
}

export function activateUser(id: string, senhaHash: string) {
  return prisma.user.update({ where: { id }, data: { senhaHash, status: 'ativo' } });
}

interface UpdateRoleStatusInput {
  papel?: 'admin' | 'operador';
  status?: 'ativo' | 'inativo';
}

export function updateUserRoleStatus(id: string, input: UpdateRoleStatusInput) {
  return prisma.user.update({ where: { id }, data: input });
}

export function deactivateUser(id: string) {
  return prisma.user.update({ where: { id }, data: { status: 'inativo' } });
}

export function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}

/** Usado na regra "não rebaixar/inativar o último admin ativo". */
export function countActiveAdmins(excludeUserId?: string) {
  return prisma.user.count({
    where: { papel: 'admin', status: 'ativo', ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
  });
}
