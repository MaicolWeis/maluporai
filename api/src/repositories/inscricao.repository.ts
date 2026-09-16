import type { InscricaoStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { withInjectedTenant } from '../lib/tenant-injected-input.js';

const LISTA_SELECT = {
  id: true,
  status: true,
  levaAcompanhante: true,
  nomeAcompanhante: true,
  seguroViagem: true,
  valorTotal: true,
  createdAt: true,
  cliente: { select: { id: true, nome: true, telefone: true } },
  pagamentos: { select: { valor: true, forma: true } },
} satisfies Prisma.InscricaoSelect;

export function listInscricoesPorViagem(viagemId: string) {
  return prisma.inscricao.findMany({
    where: { viagemId },
    select: LISTA_SELECT,
    orderBy: { createdAt: 'asc' },
  });
}

/** Só as confirmadas contam ocupação — lista de espera e canceladas, não. */
export function listInscricoesConfirmadasParaOcupacao(viagemId: string) {
  return prisma.inscricao.findMany({
    where: { viagemId, status: 'confirmada' },
    select: { levaAcompanhante: true },
  });
}

/**
 * @@unique([viagemId, clienteId]) no schema vale pra qualquer status —
 * inclusive uma inscrição já cancelada continua ocupando o par. Checado
 * aqui antes do create pra devolver um 409 com código próprio em vez de
 * deixar a violação de constraint estourar como 500.
 */
export function findInscricaoPorClienteEViagem(viagemId: string, clienteId: string) {
  return prisma.inscricao.findUnique({ where: { viagemId_clienteId: { viagemId, clienteId } } });
}

export function findInscricaoByIdOrNull(id: string) {
  return prisma.inscricao.findUnique({ where: { id }, include: { viagem: true } });
}

interface CreateInscricaoInput {
  clienteId: string;
  levaAcompanhante: boolean;
  nomeAcompanhante?: string;
  docAcompanhante?: string;
  seguroViagem: boolean;
  seguradora?: string;
  numeroApolice?: string;
  valorTotal: number;
  status: InscricaoStatus;
}

export function createInscricao(viagemId: string, input: CreateInscricaoInput) {
  return prisma.inscricao.create({
    data: withInjectedTenant<Prisma.InscricaoUncheckedCreateInput>({ ...input, viagemId }),
    select: LISTA_SELECT,
  });
}

interface UpdateInscricaoInput {
  levaAcompanhante?: boolean;
  nomeAcompanhante?: string;
  docAcompanhante?: string;
  seguroViagem?: boolean;
  seguradora?: string;
  numeroApolice?: string;
  valorTotal?: number;
}

export function updateInscricao(id: string, input: UpdateInscricaoInput) {
  return prisma.inscricao.update({ where: { id }, data: input, select: LISTA_SELECT });
}

export function cancelarInscricaoRepo(id: string) {
  return prisma.inscricao.update({ where: { id }, data: { status: 'cancelada' }, select: LISTA_SELECT });
}
