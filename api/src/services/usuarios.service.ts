import type { UserRole, UserStatus } from '@prisma/client';
import { env } from '../config/env.js';
import { AppError, forbidden, notFound } from '../lib/errors.js';
import { generateOpaqueToken, hashOpaqueToken } from '../lib/tokens.js';
import { createActivationToken } from '../repositories/activation-token.repository.js';
import { recordAuditLog } from '../repositories/audit-log.repository.js';
import { findUserAuthByEmail } from '../repositories/auth-bootstrap.repository.js';
import {
  countActiveAdmins,
  createInvitedUser,
  deactivateUser,
  deleteUser,
  findUserByIdOrNull,
  listUsers,
  updateUserRoleStatus,
} from '../repositories/user.repository.js';
import type { AtualizarUsuarioInput, ConvidarUsuarioInput } from '../schemas/usuarios.schema.js';
import { emailService } from './email.service.js';

interface Ator {
  userId: string;
}

interface RequestMeta {
  ip?: string;
}

interface PublicUser {
  id: string;
  nome: string;
  email: string;
  papel: UserRole;
  status: UserStatus;
  ultimoLoginAt: Date | null;
}

function toPublicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    papel: user.papel,
    status: user.status,
    ultimoLoginAt: user.ultimoLoginAt,
  };
}

export async function listarUsuarios(): Promise<PublicUser[]> {
  const users = await listUsers();
  return users.map(toPublicUser);
}

export async function convidarUsuario(
  input: ConvidarUsuarioInput,
  ator: Ator,
  meta: RequestMeta,
): Promise<PublicUser> {
  const existing = await findUserAuthByEmail(input.email);
  if (existing) {
    throw new AppError(409, 'EMAIL_EM_USO', 'Este e-mail já está cadastrado');
  }

  const rawToken = generateOpaqueToken();
  const user = await createInvitedUser({ nome: input.nome, email: input.email, papel: input.papel });
  await createActivationToken({ userId: user.id, tokenHash: hashOpaqueToken(rawToken) });
  await recordAuditLog({
    acao: 'create',
    entidade: 'user',
    entidadeId: user.id,
    userId: ator.userId,
    ip: meta.ip,
    dadosDepois: { nome: input.nome, email: input.email, papel: input.papel },
  });

  const activationUrl = `${env.FRONTEND_URL}/ativar-conta/${rawToken}`;
  await emailService.send({
    to: user.email,
    subject: 'Você foi convidado — maluporai',
    html: `<p>Olá, ${user.nome}.</p><p>Você foi convidado para acessar o maluporai. Defina sua senha para ativar a conta (link válido por 72h):</p><p><a href="${activationUrl}">${activationUrl}</a></p>`,
  });

  return toPublicUser(user);
}

/**
 * Regra do último admin: se o alvo é hoje um admin ativo e a mudança faria
 * ele deixar de ser (papel != admin OU status != ativo), precisa sobrar
 * pelo menos mais um admin ativo no tenant.
 */
async function garantirNaoRemoveUltimoAdmin(
  target: { id: string; papel: UserRole; status: UserStatus },
  resultingPapel: UserRole,
  resultingStatus: UserStatus,
) {
  const eraAdminAtivo = target.papel === 'admin' && target.status === 'ativo';
  const deixaDeSerAdminAtivo = resultingPapel !== 'admin' || resultingStatus !== 'ativo';

  if (eraAdminAtivo && deixaDeSerAdminAtivo) {
    const outrosAdminsAtivos = await countActiveAdmins(target.id);
    if (outrosAdminsAtivos === 0) {
      throw new AppError(400, 'LAST_ADMIN', 'Não é possível rebaixar ou inativar o último admin ativo do tenant');
    }
  }
}

export async function atualizarUsuario(
  targetId: string,
  input: AtualizarUsuarioInput,
  ator: Ator,
  meta: RequestMeta,
): Promise<PublicUser> {
  const target = await findUserByIdOrNull(targetId);
  if (!target) throw notFound();

  if (targetId === ator.userId && input.papel !== undefined) {
    throw forbidden('Você não pode alterar o seu próprio papel');
  }

  await garantirNaoRemoveUltimoAdmin(target, input.papel ?? target.papel, input.status ?? target.status);

  const updated = await updateUserRoleStatus(targetId, input);
  await recordAuditLog({
    acao: 'update',
    entidade: 'user',
    entidadeId: targetId,
    userId: ator.userId,
    ip: meta.ip,
    dadosDepois: input,
  });

  return toPublicUser(updated);
}

export async function excluirUsuario(targetId: string, ator: Ator, meta: RequestMeta): Promise<void> {
  const target = await findUserByIdOrNull(targetId);
  if (!target) throw notFound();

  // Excluir (ou, na prática, inativar) também tira o alvo de "admin ativo".
  await garantirNaoRemoveUltimoAdmin(target, target.papel, 'inativo');

  if (target.ultimoLoginAt === null) {
    await deleteUser(targetId);
    await recordAuditLog({ acao: 'delete', entidade: 'user', entidadeId: targetId, userId: ator.userId, ip: meta.ip });
  } else {
    await deactivateUser(targetId);
    await recordAuditLog({
      acao: 'update',
      entidade: 'user',
      entidadeId: targetId,
      userId: ator.userId,
      ip: meta.ip,
      dadosDepois: { status: 'inativo' },
    });
  }
}
