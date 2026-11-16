import { Prisma, type Viagem, type ViagemStatus } from '@prisma/client';
import { AppError, notFound } from '../lib/errors.js';
import { somarPagamentos } from '../lib/pagamento.js';
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
    .reduce((soma, i) => soma.add(somarPagamentos(i.pagamentos)), new Prisma.Decimal(0));

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
  const filtro = {
    status: query.status,
    dataInicio: query.dataInicio,
    dataFim: query.dataFim,
    incluirArquivadas: query.incluirArquivadas,
  };

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

  // Edição parcial: compara a data enviada com a que já está salva.
  const inicio = input.dataInicio ?? existente.dataInicio;
  const fim = input.dataFim ?? existente.dataFim;
  if (fim < inicio) {
    throw new AppError(400, 'DATAS_INVALIDAS', 'A data final não pode ser anterior à data de início');
  }

  await updateViagem(id, input);
  await auditarViagem('update', id, ator, meta, { ...input });
  return obterViagem(id);
}

const TRANSICOES_VALIDAS: Record<ViagemStatus, ViagemStatus[]> = {
  planejamento: ['inscricoes', 'cancelada'],
  inscricoes: ['confirmada', 'cancelada'],
  confirmada: ['concluida', 'cancelada'],
  // Arquivar: viagem que já aconteceu sai da visão geral e da lista padrão.
  concluida: ['arquivada'],
  cancelada: [],
  arquivada: ['concluida'],
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

export async function garantirViagem(viagemId: string) {
  const viagem = await findViagemByIdOrNull(viagemId);
  if (!viagem) throw notFound('Viagem não encontrada');
  return viagem;
}

/** Sub-recursos (hotel/atração/incluso) também entram na trilha de auditoria (P11). */
async function auditarSub(
  acao: 'create' | 'update' | 'delete',
  entidade: string,
  id: string,
  viagemId: string,
  ator: Ator | undefined,
  meta: RequestMeta | undefined,
  dados?: Record<string, unknown>,
) {
  if (!ator) return;
  await recordAuditLog({
    acao,
    entidade,
    entidadeId: id,
    userId: ator.userId,
    ip: meta?.ip,
    dadosDepois: { viagemId, ...dados } as Prisma.InputJsonValue,
  });
}

export async function criarHotel(viagemId: string, input: CriarHotelInput, ator?: Ator, meta?: RequestMeta) {
  await garantirViagem(viagemId);
  const criado = await createHotel(viagemId, input);
  await auditarSub('create', 'viagem_hotel', criado.id, viagemId, ator, meta, { ...input });
  return criado;
}

export async function atualizarHotel(viagemId: string, hotelId: string, input: AtualizarHotelInput, ator?: Ator, meta?: RequestMeta) {
  await garantirViagem(viagemId);
  const hotel = await findHotelByIdOrNull(hotelId);
  if (!hotel || hotel.viagemId !== viagemId) throw notFound('Hotel não encontrado');
  const checkIn = input.checkIn ?? hotel.checkIn;
  const checkOut = input.checkOut ?? hotel.checkOut;
  if (checkIn && checkOut && checkOut < checkIn) {
    throw new AppError(400, 'DATAS_INVALIDAS', 'O check-out não pode ser anterior ao check-in');
  }
  const atualizado = await updateHotel(hotelId, input);
  await auditarSub('update', 'viagem_hotel', hotelId, viagemId, ator, meta, { ...input });
  return atualizado;
}

export async function excluirHotel(viagemId: string, hotelId: string, ator?: Ator, meta?: RequestMeta) {
  await garantirViagem(viagemId);
  const hotel = await findHotelByIdOrNull(hotelId);
  if (!hotel || hotel.viagemId !== viagemId) throw notFound('Hotel não encontrado');
  await deleteHotel(hotelId);
  await auditarSub('delete', 'viagem_hotel', hotelId, viagemId, ator, meta);
}

export async function criarAtracao(viagemId: string, input: CriarAtracaoInput, ator?: Ator, meta?: RequestMeta) {
  await garantirViagem(viagemId);
  const criado = await createAtracao(viagemId, input);
  await auditarSub('create', 'viagem_atracao', criado.id, viagemId, ator, meta, { ...input });
  return criado;
}

export async function atualizarAtracao(viagemId: string, atracaoId: string, input: AtualizarAtracaoInput, ator?: Ator, meta?: RequestMeta) {
  await garantirViagem(viagemId);
  const atracao = await findAtracaoByIdOrNull(atracaoId);
  if (!atracao || atracao.viagemId !== viagemId) throw notFound('Atração não encontrada');
  const atualizado = await updateAtracao(atracaoId, input);
  await auditarSub('update', 'viagem_atracao', atracaoId, viagemId, ator, meta, { ...input });
  return atualizado;
}

export async function excluirAtracao(viagemId: string, atracaoId: string, ator?: Ator, meta?: RequestMeta) {
  await garantirViagem(viagemId);
  const atracao = await findAtracaoByIdOrNull(atracaoId);
  if (!atracao || atracao.viagemId !== viagemId) throw notFound('Atração não encontrada');
  await deleteAtracao(atracaoId);
  await auditarSub('delete', 'viagem_atracao', atracaoId, viagemId, ator, meta);
}

export async function criarIncluso(viagemId: string, input: CriarInclusoInput, ator?: Ator, meta?: RequestMeta) {
  await garantirViagem(viagemId);
  const criado = await createIncluso(viagemId, input);
  await auditarSub('create', 'viagem_incluso', criado.id, viagemId, ator, meta, { ...input });
  return criado;
}

export async function atualizarIncluso(viagemId: string, inclusoId: string, input: AtualizarInclusoInput, ator?: Ator, meta?: RequestMeta) {
  await garantirViagem(viagemId);
  const incluso = await findInclusoByIdOrNull(inclusoId);
  if (!incluso || incluso.viagemId !== viagemId) throw notFound('Item incluso não encontrado');
  const atualizado = await updateIncluso(inclusoId, input);
  await auditarSub('update', 'viagem_incluso', inclusoId, viagemId, ator, meta, { ...input });
  return atualizado;
}

export async function excluirIncluso(viagemId: string, inclusoId: string, ator?: Ator, meta?: RequestMeta) {
  await garantirViagem(viagemId);
  const incluso = await findInclusoByIdOrNull(inclusoId);
  if (!incluso || incluso.viagemId !== viagemId) throw notFound('Item incluso não encontrado');
  await deleteIncluso(inclusoId);
  await auditarSub('delete', 'viagem_incluso', inclusoId, viagemId, ator, meta);
}
