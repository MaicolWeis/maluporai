import { Prisma, type Viagem, type ViagemStatus } from '@prisma/client';
import { AppError, notFound } from '../lib/errors.js';
import { recordAuditLog } from '../repositories/audit-log.repository.js';
import {
  cancelarInscricoesDaViagem,
  countInscricoesDaViagem,
  createAtracao,
  createHotel,
  createIncluso,
  createViagem,
  deleteAtracao,
  deleteHotel,
  deleteIncluso,
  deleteViagem,
  findAtracaoByIdOrNull,
  findHotelByIdOrNull,
  findInclusoByIdOrNull,
  findViagemByIdOrNull,
  findViagemComDetalhe,
  listViagens,
  countViagens,
  updateAtracao,
  updateHotel,
  updateIncluso,
  updateViagem,
  updateViagemStatus,
} from '../repositories/viagem.repository.js';
import type {
  AtualizarAtracaoInput,
  AtualizarHotelInput,
  AtualizarInclusoInput,
  AtualizarStatusViagemInput,
  AtualizarViagemInput,
  CriarAtracaoInput,
  CriarHotelInput,
  CriarInclusoInput,
  CriarViagemInput,
  ListarViagensQuery,
} from '../schemas/viagens.schema.js';

interface Ator {
  userId: string;
}

interface RequestMeta {
  ip?: string;
}

type ComAgregados = {
  capacidade: number;
  inscricoes: {
    status: string;
    levaAcompanhante: boolean;
    pagamentos: { valor: Prisma.Decimal }[];
  }[];
  despesas: { valor: Prisma.Decimal }[];
};

/**
 * "Pessoas confirmadas" conta só inscrições com status confirmada (titular +
 * acompanhante, quando houver); "total recebido" soma pagamentos das
 * inscrições que não foram canceladas (pagamento de uma inscrição cancelada
 * deixa de representar dinheiro "da viagem" — não há modelagem de estorno
 * ainda, então trata como não contabilizado aqui).
 */
function calcularAgregados(viagem: ComAgregados) {
  const pessoasConfirmadas = viagem.inscricoes
    .filter((i) => i.status === 'confirmada')
    .reduce((total, i) => total + 1 + (i.levaAcompanhante ? 1 : 0), 0);

  const totalRecebido = viagem.inscricoes
    .filter((i) => i.status !== 'cancelada')
    .reduce((soma, i) => i.pagamentos.reduce((s, p) => s.add(p.valor), soma), new Prisma.Decimal(0));

  const totalDespesas = viagem.despesas.reduce((soma, d) => soma.add(d.valor), new Prisma.Decimal(0));

  return {
    pessoasConfirmadas,
    capacidade: viagem.capacidade,
    totalRecebido,
    totalDespesas,
  };
}

function toListItemDTO(viagem: Viagem & ComAgregados) {
  return {
    id: viagem.id,
    nome: viagem.nome,
    destinoCidade: viagem.destinoCidade,
    destinoUf: viagem.destinoUf,
    dataInicio: viagem.dataInicio,
    dataFim: viagem.dataFim,
    status: viagem.status,
    ...calcularAgregados(viagem),
  };
}

function toDetailDTO(
  viagem: Viagem &
    ComAgregados & {
      hoteis: unknown[];
      atracoes: unknown[];
      inclusos: unknown[];
    },
) {
  return {
    id: viagem.id,
    nome: viagem.nome,
    destinoCidade: viagem.destinoCidade,
    destinoUf: viagem.destinoUf,
    dataInicio: viagem.dataInicio,
    dataFim: viagem.dataFim,
    capacidade: viagem.capacidade,
    precoTitular: viagem.precoTitular,
    precoAcompanhante: viagem.precoAcompanhante,
    status: viagem.status,
    descricao: viagem.descricao,
    createdAt: viagem.createdAt,
    updatedAt: viagem.updatedAt,
    hoteis: viagem.hoteis,
    atracoes: viagem.atracoes,
    inclusos: viagem.inclusos,
    agregados: calcularAgregados(viagem),
  };
}

export async function listarViagens(query: ListarViagensQuery) {
  const skip = (query.pagina - 1) * query.porPagina;
  const filtro = { status: query.status, dataInicio: query.dataInicio, dataFim: query.dataFim };

  const [viagens, total] = await Promise.all([
    listViagens({ ...filtro, skip, take: query.porPagina }),
    countViagens(filtro),
  ]);

  return {
    viagens: viagens.map(toListItemDTO),
    paginacao: {
      pagina: query.pagina,
      porPagina: query.porPagina,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / query.porPagina)),
    },
  };
}

export async function obterViagem(id: string) {
  const viagem = await findViagemComDetalhe(id);
  if (!viagem) throw notFound();
  return toDetailDTO(viagem);
}

async function auditarViagem(
  acao: 'create' | 'update' | 'delete',
  id: string,
  ator: Ator,
  meta: RequestMeta,
  dadosDepois?: Prisma.InputJsonValue,
) {
  await recordAuditLog({ acao, entidade: 'viagem', entidadeId: id, userId: ator.userId, ip: meta.ip, dadosDepois });
}

export async function criarViagem(input: CriarViagemInput, ator: Ator, meta: RequestMeta) {
  const viagem = await createViagem(input);
  await auditarViagem('create', viagem.id, ator, meta, { nome: input.nome, destinoCidade: input.destinoCidade });
  return obterViagem(viagem.id);
}

export async function atualizarViagem(id: string, input: AtualizarViagemInput, ator: Ator, meta: RequestMeta) {
  const existente = await findViagemByIdOrNull(id);
  if (!existente) throw notFound();

  await updateViagem(id, input);
  await auditarViagem('update', id, ator, meta, { ...input });
  return obterViagem(id);
}

const TRANSICOES_VALIDAS: Record<ViagemStatus, ViagemStatus[]> = {
  planejamento: ['inscricoes', 'cancelada'],
  inscricoes: ['confirmada', 'cancelada'],
  confirmada: ['concluida', 'cancelada'],
  concluida: [],
  cancelada: [],
};

export async function atualizarStatusViagem(
  id: string,
  input: AtualizarStatusViagemInput,
  ator: Ator,
  meta: RequestMeta,
) {
  const viagem = await findViagemByIdOrNull(id);
  if (!viagem) throw notFound();

  if (!TRANSICOES_VALIDAS[viagem.status].includes(input.status)) {
    throw new AppError(
      400,
      'TRANSICAO_INVALIDA',
      `Não é possível mudar de "${viagem.status}" para "${input.status}"`,
    );
  }

  if (input.status === 'cancelada') {
    const totalInscricoes = await countInscricoesDaViagem(id);
    if (totalInscricoes > 0 && !input.motivo) {
      throw new AppError(400, 'MOTIVO_OBRIGATORIO', 'Cancelar viagem com inscrições exige um motivo');
    }
    if (totalInscricoes > 0) {
      await cancelarInscricoesDaViagem(id);
    }
  }

  await updateViagemStatus(id, input.status);
  await auditarViagem('update', id, ator, meta, {
    statusAnterior: viagem.status,
    statusNovo: input.status,
    motivo: input.motivo,
  });
  return obterViagem(id);
}

export async function excluirViagem(id: string, ator: Ator, meta: RequestMeta) {
  const viagem = await findViagemByIdOrNull(id);
  if (!viagem) throw notFound();

  if (viagem.status !== 'planejamento') {
    throw new AppError(409, 'VIAGEM_NAO_EDITAVEL', 'Só é possível excluir viagens em planejamento');
  }

  const totalInscricoes = await countInscricoesDaViagem(id);
  if (totalInscricoes > 0) {
    throw new AppError(409, 'VIAGEM_COM_INSCRICAO', 'Viagem possui inscrições e não pode ser excluída');
  }

  await deleteViagem(id);
  await auditarViagem('delete', id, ator, meta);
}

// ---------------------------------------------------------------------------
// Sub-recursos: hotéis, atrações, inclusos
// ---------------------------------------------------------------------------

async function garantirViagem(viagemId: string) {
  const viagem = await findViagemByIdOrNull(viagemId);
  if (!viagem) throw notFound('Viagem não encontrada');
  return viagem;
}

export async function criarHotel(viagemId: string, input: CriarHotelInput) {
  await garantirViagem(viagemId);
  return createHotel(viagemId, input);
}

export async function atualizarHotel(viagemId: string, hotelId: string, input: AtualizarHotelInput) {
  await garantirViagem(viagemId);
  const hotel = await findHotelByIdOrNull(hotelId);
  if (!hotel || hotel.viagemId !== viagemId) throw notFound('Hotel não encontrado');
  return updateHotel(hotelId, input);
}

export async function excluirHotel(viagemId: string, hotelId: string) {
  await garantirViagem(viagemId);
  const hotel = await findHotelByIdOrNull(hotelId);
  if (!hotel || hotel.viagemId !== viagemId) throw notFound('Hotel não encontrado');
  await deleteHotel(hotelId);
}

export async function criarAtracao(viagemId: string, input: CriarAtracaoInput) {
  await garantirViagem(viagemId);
  return createAtracao(viagemId, input);
}

export async function atualizarAtracao(viagemId: string, atracaoId: string, input: AtualizarAtracaoInput) {
  await garantirViagem(viagemId);
  const atracao = await findAtracaoByIdOrNull(atracaoId);
  if (!atracao || atracao.viagemId !== viagemId) throw notFound('Atração não encontrada');
  return updateAtracao(atracaoId, input);
}

export async function excluirAtracao(viagemId: string, atracaoId: string) {
  await garantirViagem(viagemId);
  const atracao = await findAtracaoByIdOrNull(atracaoId);
  if (!atracao || atracao.viagemId !== viagemId) throw notFound('Atração não encontrada');
  await deleteAtracao(atracaoId);
}

export async function criarIncluso(viagemId: string, input: CriarInclusoInput) {
  await garantirViagem(viagemId);
  return createIncluso(viagemId, input);
}

export async function atualizarIncluso(viagemId: string, inclusoId: string, input: AtualizarInclusoInput) {
  await garantirViagem(viagemId);
  const incluso = await findInclusoByIdOrNull(inclusoId);
  if (!incluso || incluso.viagemId !== viagemId) throw notFound('Item incluso não encontrado');
  return updateIncluso(inclusoId, input);
}

export async function excluirIncluso(viagemId: string, inclusoId: string) {
  await garantirViagem(viagemId);
  const incluso = await findInclusoByIdOrNull(inclusoId);
  if (!incluso || incluso.viagemId !== viagemId) throw notFound('Item incluso não encontrado');
  await deleteIncluso(inclusoId);
}
