import { randomUUID } from 'node:crypto';
import type { UserRole } from '@prisma/client';
import { AppError, unauthorized } from '../lib/errors.js';
import { env } from '../config/env.js';
import { signAccessToken } from '../lib/jwt.js';
import { logger } from '../lib/logger.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { prisma } from '../lib/prisma.js';
import { runWithTenant } from '../lib/tenant-context.js';
import { generateOpaqueToken, hashOpaqueToken } from '../lib/tokens.js';
import { markActivationTokenUsed } from '../repositories/activation-token.repository.js';
import {
  findActivationTokenByHash,
  findRefreshTokenByHash,
  findResetTokenByHash,
  findUserAuthByEmail,
} from '../repositories/auth-bootstrap.repository.js';
import { recordAuditLog } from '../repositories/audit-log.repository.js';
import {
  createPasswordResetToken,
  markPasswordResetTokenUsed,
} from '../repositories/password-reset-token.repository.js';
import {
  createRefreshToken,
  revokeAllRefreshTokensForUser,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
} from '../repositories/refresh-token.repository.js';
import { createDefaultTenantSettings, createTenant, markTenantCancelada } from '../repositories/tenant.repository.js';
import {
  activateUser,
  createAdminUser,
  findUserById,
  touchLastLogin,
  updatePasswordHash,
} from '../repositories/user.repository.js';
import type { AtivarContaInput, LoginInput, RedefinirSenhaInput, SignupInput } from '../schemas/auth.schema.js';
import { emailService } from './email.service.js';

const INVALID_CREDENTIALS_MESSAGE = 'Credenciais inválidas';
const INVALID_SESSION_MESSAGE = 'Sessão inválida, faça login novamente';

export interface SessionUserDTO {
  id: string;
  nome: string;
  email: string;
  papel: UserRole;
  tenant: { id: string; nomeFantasia: string };
}

export interface SessionResult {
  accessToken: string;
  refreshToken: string;
  user: SessionUserDTO;
}

interface RequestMeta {
  ip?: string;
}

function toSessionUser(
  user: { id: string; nome: string; email: string; papel: UserRole },
  tenant: { id: string; nomeFantasia: string },
): SessionUserDTO {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    papel: user.papel,
    tenant: { id: tenant.id, nomeFantasia: tenant.nomeFantasia },
  };
}

// Hash fixo (calculado uma vez) usado para rodar o argon2.verify mesmo
// quando o e-mail não existe — sem isso, a resposta de e-mail inexistente
// seria visivelmente mais rápida que a de senha errada (timing side-channel
// que vaza se o e-mail existe, o mesmo problema que a mensagem genérica do
// enunciado já busca evitar no corpo da resposta).
let dummyHashPromise: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('senha-fixa-so-para-normalizar-timing');
  return dummyHashPromise;
}

// ---------------------------------------------------------------------------
// Signup
// ---------------------------------------------------------------------------

/**
 * Cria tenant + tenant_settings + usuário admin. Único fluxo que roda ANTES
 * de existir tenant no contexto: gera o uuid do tenant em código e abre o
 * contexto com runWithTenant já com esse id (Tenant é isento da checagem de
 * contexto — ver TENANT_EXEMPT_MODELS em lib/prisma.ts — então pode ser
 * criado dentro do próprio contexto sem problema).
 *
 * Não usa prisma.$transaction interativa: a extensão de tenant abre sua
 * própria transação por operação (para o SET LOCAL do RLS), e uma
 * transação interativa aninhada quebraria essa propagação. Em vez disso,
 * se algo falhar depois do tenant já criado, o tenant é marcado como
 * "cancelado" (compensação) — app_user não tem DELETE em tenants por
 * desenho (nenhuma feature do produto apaga tenant).
 */
export async function signup(input: SignupInput, meta: RequestMeta): Promise<SessionResult> {
  const existing = await findUserAuthByEmail(input.email);
  if (existing) {
    throw new AppError(409, 'EMAIL_EM_USO', 'Este e-mail já está cadastrado');
  }

  const tenantId = randomUUID();
  const familyId = randomUUID();
  const rawRefreshToken = generateOpaqueToken();
  const senhaHash = await hashPassword(input.senha);

  const { accessToken, user } = await runWithTenant(tenantId, async () => {
    const tenant = await createTenant({
      id: tenantId,
      nomeFantasia: input.nomeFantasia,
      documento: input.documento,
      emailContato: input.email,
    });

    try {
      await createDefaultTenantSettings();
      const createdUser = await createAdminUser({ nome: input.nome, email: input.email, senhaHash });
      await createRefreshToken({
        userId: createdUser.id,
        familyId,
        tokenHash: hashOpaqueToken(rawRefreshToken),
        createdByIp: meta.ip,
      });
      await recordAuditLog({
        acao: 'create',
        entidade: 'tenant',
        entidadeId: tenant.id,
        userId: createdUser.id,
        ip: meta.ip,
      });

      return {
        accessToken: signAccessToken({ sub: createdUser.id, tenantId, papel: createdUser.papel }),
        user: toSessionUser(createdUser, tenant),
      };
    } catch (err) {
      logger.error({ err, tenantId }, 'Falha ao concluir signup — marcando tenant como cancelado');
      await markTenantCancelada(tenant.id).catch(() => {});
      throw err;
    }
  });

  return { accessToken, refreshToken: rawRefreshToken, user };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(input: LoginInput, meta: RequestMeta): Promise<SessionResult> {
  const auth = await findUserAuthByEmail(input.email);
  const senhaParaComparar = auth?.senha_hash ?? (await getDummyHash());
  const senhaOk = await verifyPassword(senhaParaComparar, input.senha);

  if (!auth || auth.status !== 'ativo' || !senhaOk) {
    throw unauthorized(INVALID_CREDENTIALS_MESSAGE);
  }

  const familyId = randomUUID();
  const rawRefreshToken = generateOpaqueToken();

  const { accessToken, user } = await runWithTenant(auth.tenant_id, async () => {
    await touchLastLogin(auth.id);
    await createRefreshToken({
      userId: auth.id,
      familyId,
      tokenHash: hashOpaqueToken(rawRefreshToken),
      createdByIp: meta.ip,
    });
    await recordAuditLog({ acao: 'login', entidade: 'user', entidadeId: auth.id, userId: auth.id, ip: meta.ip });

    const userRow = await findUserById(auth.id);
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: auth.tenant_id } });
    return {
      accessToken: signAccessToken({ sub: userRow.id, tenantId: auth.tenant_id, papel: userRow.papel }),
      user: toSessionUser(userRow, tenant),
    };
  });

  return { accessToken, refreshToken: rawRefreshToken, user };
}

// ---------------------------------------------------------------------------
// Refresh (rotação a cada uso + detecção de reuso)
// ---------------------------------------------------------------------------

export async function refreshSession(rawRefreshToken: string, meta: RequestMeta): Promise<SessionResult> {
  const tokenHash = hashOpaqueToken(rawRefreshToken);
  const row = await findRefreshTokenByHash(tokenHash);

  if (!row) {
    throw unauthorized(INVALID_SESSION_MESSAGE);
  }

  if (row.revoked_at) {
    // Token já usado sendo reapresentado: possível roubo. Revoga a família
    // inteira — todo dispositivo com um token dessa linhagem perde a sessão.
    await runWithTenant(row.tenant_id, () => revokeRefreshTokenFamily(row.family_id));
    logger.warn({ tenantId: row.tenant_id, familyId: row.family_id }, 'Refresh token reutilizado — família revogada');
    throw unauthorized(INVALID_SESSION_MESSAGE);
  }

  if (row.expires_at.getTime() < Date.now()) {
    throw unauthorized(INVALID_SESSION_MESSAGE);
  }

  const newRawToken = generateOpaqueToken();

  const { accessToken, user } = await runWithTenant(row.tenant_id, async () => {
    const newToken = await createRefreshToken({
      userId: row.user_id,
      familyId: row.family_id,
      tokenHash: hashOpaqueToken(newRawToken),
      createdByIp: meta.ip,
    });
    await revokeRefreshToken(row.id, newToken.id);

    const userRow = await findUserById(row.user_id);
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: row.tenant_id } });
    return {
      accessToken: signAccessToken({ sub: userRow.id, tenantId: row.tenant_id, papel: userRow.papel }),
      user: toSessionUser(userRow, tenant),
    };
  });

  return { accessToken, refreshToken: newRawToken, user };
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;

  const tokenHash = hashOpaqueToken(rawRefreshToken);
  const row = await findRefreshTokenByHash(tokenHash);
  if (!row || row.revoked_at) return;

  await runWithTenant(row.tenant_id, () => revokeRefreshToken(row.id));
}

// ---------------------------------------------------------------------------
// Esqueci a senha / redefinir senha
// ---------------------------------------------------------------------------

export async function requestPasswordReset(email: string): Promise<void> {
  const auth = await findUserAuthByEmail(email);
  // O controller responde a mesma mensagem exista ou não o e-mail — aqui
  // simplesmente não fazemos nada quando não existe.
  if (!auth) return;

  const rawToken = generateOpaqueToken();

  const user = await runWithTenant(auth.tenant_id, async () => {
    await createPasswordResetToken({ userId: auth.id, tokenHash: hashOpaqueToken(rawToken) });
    return findUserById(auth.id);
  });

  const resetUrl = `${env.FRONTEND_URL}/redefinir-senha/${rawToken}`;
  await emailService.send({
    to: user.email,
    subject: 'Redefinição de senha — maluporai',
    html: `<p>Olá, ${user.nome}.</p><p>Para redefinir sua senha, acesse o link abaixo (válido por 30 minutos):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Se você não pediu essa redefinição, ignore este e-mail.</p>`,
  });
}

export async function resetPassword(input: RedefinirSenhaInput): Promise<void> {
  const tokenHash = hashOpaqueToken(input.token);
  const row = await findResetTokenByHash(tokenHash);

  if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'Token inválido ou expirado');
  }

  const senhaHash = await hashPassword(input.senha);

  await runWithTenant(row.tenant_id, async () => {
    await updatePasswordHash(row.user_id, senhaHash);
    await markPasswordResetTokenUsed(row.id);
    await revokeAllRefreshTokensForUser(row.user_id);
    await recordAuditLog({ acao: 'update', entidade: 'user', entidadeId: row.user_id, userId: row.user_id });
  });
}

// ---------------------------------------------------------------------------
// Ativação de convite (P3)
// ---------------------------------------------------------------------------

export async function activateAccount(input: AtivarContaInput): Promise<void> {
  const tokenHash = hashOpaqueToken(input.token);
  const row = await findActivationTokenByHash(tokenHash);

  const invalidTokenError = new AppError(400, 'INVALID_ACTIVATION_TOKEN', 'Token inválido ou expirado');
  if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
    throw invalidTokenError;
  }

  const senhaHash = await hashPassword(input.senha);

  await runWithTenant(row.tenant_id, async () => {
    const user = await findUserById(row.user_id);
    // Token válido mas a conta já não está mais 'convidado' (ativada antes
    // por outro uso do link, ou desativada nesse meio-tempo) — mesmo erro
    // genérico, não distingue os casos.
    if (user.status !== 'convidado') {
      throw invalidTokenError;
    }

    await activateUser(row.user_id, senhaHash);
    await markActivationTokenUsed(row.id);
    await recordAuditLog({ acao: 'update', entidade: 'user', entidadeId: row.user_id, userId: row.user_id });
  });
}
