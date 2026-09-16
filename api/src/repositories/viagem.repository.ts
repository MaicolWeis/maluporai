import type { Prisma, ViagemStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { withInjectedTenant } from '../lib/tenant-injected-input.js';

const AGREGADOS_INCLUDE = {
  inscricoes: {
    select: {
      status: true,
      levaAcompanhante: true,
      valorTotal: true,
      pagamentos: { select: { valor: true } },
    },
  },
  despesas: { select: { valor: true } },
} satisfies Prisma.ViagemInclude;

interface ListarViagensParams {
  status?: ViagemStatus;
  dataInicio?: Date;
  dataFim?: Date;
  skip: number;
  take: number;
}

function buildWhere({ status, dataInicio, dataFim }: Omit<ListarViagensParams, 'skip' | 'take'>) {
  const where: Prisma.ViagemWhereInput = {};
  if (status) where.status = status;
  if (dataInicio) where.dataInicio = { gte: dataInicio };
  if (dataFim) where.dataFim = { lte: dataFim };
  return where;
}

export function listViagens(params: ListarViagensParams) {
  const where = buildWhere(params);
  return prisma.viagem.findMany({
    where,
    include: AGREGADOS_INCLUDE,
    orderBy: { dataInicio: 'asc' },
    skip: params.skip,
    take: params.take,
  });
}

export function countViagens(params: Pick<ListarViagensParams, 'status' | 'dataInicio' | 'dataFim'>) {
  return prisma.viagem.count({ where: buildWhere(params) });
}

/** null quando o id não existe ou é de outro tenant (RLS) — vira 404, nunca 403. */
export function findViagemByIdOrNull(id: string) {
  return prisma.viagem.findUnique({ where: { id } });
}

export function findViagemComDetalhe(id: string) {
  return prisma.viagem.findUnique({
    where: { id },
    include: {
      hoteis: true,
      atracoes: true,
      inclusos: { orderBy: { ordem: 'asc' } },
      ...AGREGADOS_INCLUDE,
    },
  });
}

interface CreateViagemInput {
  nome: string;
  destinoCidade: string;
  destinoUf: string;
  dataInicio: Date;
  dataFim: Date;
  capacidade: number;
  precoTitular: number;
  precoAcompanhante?: number;
  descricao?: string;
}

export function createViagem(input: CreateViagemInput) {
  return prisma.viagem.create({ data: withInjectedTenant<Prisma.ViagemUncheckedCreateInput>(input) });
}

interface UpdateViagemInput {
  nome?: string;
  destinoCidade?: string;
  destinoUf?: string;
  dataInicio?: Date;
  dataFim?: Date;
  capacidade?: number;
  precoTitular?: number;
  precoAcompanhante?: number;
  descricao?: string;
}

export function updateViagem(id: string, input: UpdateViagemInput) {
  return prisma.viagem.update({ where: { id }, data: input });
}

export function updateViagemStatus(id: string, status: ViagemStatus) {
  return prisma.viagem.update({ where: { id }, data: { status } });
}

/**
 * Sem cascade no schema para hoteis/atracoes/inclusos — só chega aqui quando
 * a viagem está em planejamento e sem inscrições (checado no service), então
 * é seguro descartar esse conteúdo de logística junto. Sequencial (não
 * prisma.$transaction interativa) pelo mesmo motivo do signup: cada operação
 * já abre sua própria transação pro SET LOCAL do RLS.
 */
export async function deleteViagem(id: string) {
  await prisma.viagemHotel.deleteMany({ where: { viagemId: id } });
  await prisma.viagemAtracao.deleteMany({ where: { viagemId: id } });
  await prisma.viagemIncluso.deleteMany({ where: { viagemId: id } });
  await prisma.viagem.delete({ where: { id } });
}

export function countInscricoesDaViagem(viagemId: string) {
  return prisma.inscricao.count({ where: { viagemId } });
}

export function cancelarInscricoesDaViagem(viagemId: string) {
  return prisma.inscricao.updateMany({
    where: { viagemId, status: { not: 'cancelada' } },
    data: { status: 'cancelada' },
  });
}

// ---------------------------------------------------------------------------
// Sub-recursos: hotéis, atrações, inclusos
// ---------------------------------------------------------------------------

interface HotelInput {
  nome: string;
  cidade?: string;
  telefone?: string;
  checkIn?: Date;
  checkOut?: Date;
  valorNegociado?: number;
  observacoes?: string;
}

export function findHotelByIdOrNull(id: string) {
  return prisma.viagemHotel.findUnique({ where: { id } });
}

export function createHotel(viagemId: string, input: HotelInput) {
  return prisma.viagemHotel.create({
    data: withInjectedTenant<Prisma.ViagemHotelUncheckedCreateInput>({ ...input, viagemId }),
  });
}

export function updateHotel(id: string, input: Partial<HotelInput>) {
  return prisma.viagemHotel.update({ where: { id }, data: input });
}

export function deleteHotel(id: string) {
  return prisma.viagemHotel.delete({ where: { id } });
}

interface AtracaoInput {
  nome: string;
  tipo: 'parque' | 'passeio' | 'refeicao' | 'outro';
  valorEntrada?: number;
  incluso: boolean;
  observacoes?: string;
}

export function findAtracaoByIdOrNull(id: string) {
  return prisma.viagemAtracao.findUnique({ where: { id } });
}

export function createAtracao(viagemId: string, input: AtracaoInput) {
  return prisma.viagemAtracao.create({
    data: withInjectedTenant<Prisma.ViagemAtracaoUncheckedCreateInput>({ ...input, viagemId }),
  });
}

export function updateAtracao(id: string, input: Partial<AtracaoInput>) {
  return prisma.viagemAtracao.update({ where: { id }, data: input });
}

export function deleteAtracao(id: string) {
  return prisma.viagemAtracao.delete({ where: { id } });
}

interface InclusoInput {
  descricao: string;
  ordem: number;
}

export function findInclusoByIdOrNull(id: string) {
  return prisma.viagemIncluso.findUnique({ where: { id } });
}

export function createIncluso(viagemId: string, input: InclusoInput) {
  return prisma.viagemIncluso.create({
    data: withInjectedTenant<Prisma.ViagemInclusoUncheckedCreateInput>({ ...input, viagemId }),
  });
}

export function updateIncluso(id: string, input: Partial<InclusoInput>) {
  return prisma.viagemIncluso.update({ where: { id }, data: input });
}

export function deleteIncluso(id: string) {
  return prisma.viagemIncluso.delete({ where: { id } });
}
