import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { withInjectedTenant } from '../lib/tenant-injected-input.js';

const LISTA_SELECT = {
  id: true,
  nome: true,
  telefone: true,
  cidade: true,
  uf: true,
  consentimentoMarketing: true,
  anonimizadoEm: true,
  createdAt: true,
  inscricoes: {
    select: { viagem: { select: { id: true, nome: true } } },
  },
} satisfies Prisma.ClienteSelect;

interface ListarClientesParams {
  busca?: string;
  comInscricaoAtiva?: boolean;
  skip: number;
  take: number;
}

function buildWhere({ busca, comInscricaoAtiva }: Pick<ListarClientesParams, 'busca' | 'comInscricaoAtiva'>) {
  const where: Prisma.ClienteWhereInput = {};
  if (busca) {
    where.OR = [
      { nome: { contains: busca, mode: 'insensitive' } },
      { telefone: { contains: busca } },
      { cidade: { contains: busca, mode: 'insensitive' } },
    ];
  }
  if (comInscricaoAtiva) {
    where.inscricoes = { some: { status: { not: 'cancelada' } } };
  }
  return where;
}

export function listClientes(params: ListarClientesParams) {
  const where = buildWhere(params);
  return prisma.cliente.findMany({
    where,
    select: LISTA_SELECT,
    orderBy: { nome: 'asc' },
    skip: params.skip,
    take: params.take,
  });
}

export function countClientes(params: Pick<ListarClientesParams, 'busca' | 'comInscricaoAtiva'>) {
  return prisma.cliente.count({ where: buildWhere(params) });
}

/** null quando o id não existe ou é de outro tenant (RLS) — vira 404, nunca 403. */
export function findClienteByIdOrNull(id: string) {
  return prisma.cliente.findUnique({ where: { id } });
}

export function findClienteComHistorico(id: string) {
  return prisma.cliente.findUnique({
    where: { id },
    include: {
      inscricoes: {
        include: {
          viagem: { select: { id: true, nome: true, destinoCidade: true, destinoUf: true } },
          pagamentos: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

interface CreateClienteInput {
  nome: string;
  telefone: string;
  cpf?: string;
  cpfHash?: string;
  email?: string;
  cidade?: string;
  uf?: string;
  dataNascimento?: Date;
  contatoEmergenciaNome?: string;
  contatoEmergenciaTelefone?: string;
  observacoes?: string;
  consentimentoMarketing: boolean;
  consentimentoEm?: Date;
}

export function createCliente(input: CreateClienteInput) {
  return prisma.cliente.create({
    data: withInjectedTenant<Prisma.ClienteUncheckedCreateInput>(input),
  });
}

interface UpdateClienteInput {
  nome?: string;
  telefone?: string;
  cpf?: string;
  cpfHash?: string;
  email?: string;
  cidade?: string;
  uf?: string;
  dataNascimento?: Date;
  contatoEmergenciaNome?: string;
  contatoEmergenciaTelefone?: string;
  observacoes?: string;
  consentimentoMarketing?: boolean;
  consentimentoEm?: Date | null;
}

export function updateCliente(id: string, input: UpdateClienteInput) {
  return prisma.cliente.update({ where: { id }, data: input });
}

export function deleteCliente(id: string) {
  return prisma.cliente.delete({ where: { id } });
}

export function countInscricoesDoCliente(clienteId: string) {
  return prisma.inscricao.count({ where: { clienteId } });
}

interface AnonimizarClienteInput {
  nome: string;
  cpf: null;
  cpfHash: null;
  telefone: string;
  email: null;
  contatoEmergenciaNome: null;
  contatoEmergenciaTelefone: null;
  anonimizadoEm: Date;
}

export function anonimizarClienteRepo(id: string, input: AnonimizarClienteInput) {
  return prisma.cliente.update({ where: { id }, data: input });
}
