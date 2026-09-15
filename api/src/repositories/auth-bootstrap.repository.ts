import type { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

/**
 * Consultas cruas (bypass de RLS via função SECURITY DEFINER — ver migrações
 * 0004_auth_lookup_functions e 0006_activation_rls_and_lookup_function)
 * usadas SOMENTE para descobrir o tenant_id antes de existir tenant no
 * contexto (login, refresh, reset de senha, ativação de convite).
 * `$queryRaw` não passa pela Prisma Client Extension de tenant (que só
 * intercepta operações de modelo), então funciona sem runWithTenant — mas
 * por isso mesmo nunca deve ser usado para nada além destas consultas.
 */

interface UserAuthRow {
  id: string;
  tenant_id: string;
  // Nulo para usuários 'convidado' que ainda não ativaram a conta.
  senha_hash: string | null;
  papel: UserRole;
  status: UserStatus;
}

interface RefreshTokenAuthRow {
  id: string;
  tenant_id: string;
  user_id: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
}

interface ResetTokenAuthRow {
  id: string;
  tenant_id: string;
  user_id: string;
  expires_at: Date;
  used_at: Date | null;
}

interface ActivationTokenAuthRow {
  id: string;
  tenant_id: string;
  user_id: string;
  expires_at: Date;
  used_at: Date | null;
}

export async function findUserAuthByEmail(email: string): Promise<UserAuthRow | null> {
  const rows = await prisma.$queryRaw<UserAuthRow[]>`SELECT * FROM auth_find_user_by_email(${email})`;
  return rows[0] ?? null;
}

export async function findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenAuthRow | null> {
  const rows = await prisma.$queryRaw<RefreshTokenAuthRow[]>`SELECT * FROM auth_find_refresh_token(${tokenHash})`;
  return rows[0] ?? null;
}

export async function findResetTokenByHash(tokenHash: string): Promise<ResetTokenAuthRow | null> {
  const rows = await prisma.$queryRaw<ResetTokenAuthRow[]>`SELECT * FROM auth_find_reset_token(${tokenHash})`;
  return rows[0] ?? null;
}

export async function findActivationTokenByHash(tokenHash: string): Promise<ActivationTokenAuthRow | null> {
  const rows = await prisma.$queryRaw<ActivationTokenAuthRow[]>`SELECT * FROM auth_find_activation_token(${tokenHash})`;
  return rows[0] ?? null;
}
