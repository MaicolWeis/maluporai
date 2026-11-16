import { Prisma, type InscricaoStatus } from '@prisma/client';
import { AppError, notFound } from '../lib/errors.js';
import { derivarStatusPagamento, somarPagamentos } from '../lib/pagamento.js';
import { recordAuditLog } from '../repositories/audit-log.repository.js';
import {
  cancelarInscricaoRepo,
  createInscricao,
  findInscricaoByIdOrNull,
  findInscricaoPorClienteEViagem,
  listInscricoesConfirmadasParaOcupacao,
  listInscricoesPorViagem,
  marcarEmbarqueRepo,
  updateInscricao,
} from '../repositories/inscricao.repository.js';
import { garantirViagem } from './viagens.service.js';
import type {
  AtualizarInscricaoInput,
  CancelarInscricaoInput,
  CriarInscricaoInput,
  EmbarqueInput,
} from '../schemas/inscricoes.schema.js';

interface Ator {
  userId: string;
}

interface RequestMeta {
  ip?: string;
}

/** Maior soma paga por forma — "Pill de forma de pagamento predominante" no protótipo. */
function formaPredominante(pagamentos: { valor: Prisma.Decimal; forma: string }[]): string | null {
  if (pagamentos.length === 0) return null;
  const totaisPorForma = new Map<string, Prisma.Decimal>();
  for (const p of pagamentos) {
    totaisPorForma.set(p.forma, (totaisPorForma.get(p.forma) ?? new Prisma.Decimal(0)).add(p.valor));
  }
  let melhorForma = pagamentos[0].forma;
  let melhorTotal = new Prisma.Decimal(0);
  for (const [forma, total] of totaisPorForma) {
    if (total.gt(melhorTotal)) {
      melhorForma = forma;
      melhorTotal = total;
    }
  }
  return melhorForma;
}

function toInscricaoDTO(inscricao: {
  id: string;
  status: InscricaoStatus;
  levaAcompanhante: boolean;
  nomeAcompanhante: string | null;
  docAcompanhante: string | null;
  seguroViagem: boolean;
  seguradora: string | null;
  numeroApolice: string | null;
  valorTotal: Prisma.Decimal;
  embarcadoEm: Date | null;
  createdAt: Date;
  cliente: { id: string; nome: string; telefone: string };
  pagamentos: { valor: Prisma.Decimal; forma: string }[];
}) {
  const valorPago = somarPagamentos(inscricao.pagamentos);
  return {
    id: inscricao.id,
    status: inscricao.status,
    cliente: inscricao.cliente,
    levaAcompanhante: inscricao.levaAcompanhante,
    nomeAcompanhante: inscricao.nomeAcompanhante,
    docAcompanhante: inscricao.docAcompanhante,
    seguroViagem: inscricao.seguroViagem,
    seguradora: inscricao.seguradora,
    numeroApolice: inscricao.numeroApolice,
    valorTotal: inscricao.valorTotal,
    valorPago,
    statusPagamento: derivarStatusPagamento(inscricao.valorTotal, valorPago),
    formaPagamentoPredominante: formaPredominante(inscricao.pagamentos),
    embarcadoEm: inscricao.embarcadoEm,
    createdAt: inscricao.createdAt,
  };
}

function contarPessoas(inscricoes: { levaAcompanhante: boolean }[]) {
  return inscricoes.reduce((total, i) => total + 1 + (i.levaAcompanhante ? 1 : 0), 0);
}

/**
 * A capacidade também é garantida no banco (trigger inscricoes_capacidade, P11),
 * que trava a viagem durante o INSERT/UPDATE. A checagem prévia acima só dá uma
 * mensagem melhor no caso comum; a corrida entre duas inscrições simultâneas
 * é resolvida aqui.
 */
async function comTravaDeCapacidade<T>(operacao: () => Promise<T>): Promise<T> {
  try {
    return await operacao();
  } catch (err) {
    if (err instanceof Error && err.message.includes('CAPACIDADE_EXCEDIDA')) {
      throw new AppError(400, 'CAPACIDADE_EXCEDIDA', 'A viagem atingiu a capacidade máxima — inscreva em lista de espera');
    }
    throw err;
  }
}

export async function listarInscricoesDaViagem(viagemId: string) {
  const viagem = await garantirViagem(viagemId);
  const inscricoes = await listInscricoesPorViagem(viagemId);
  const confirmadas = inscricoes.filter((i) => i.status === 'confirmada');
  const pessoasConfirmadas = contarPessoas(confirmadas);

  return {
    inscricoes: inscricoes.map(toInscricaoDTO),
    capacidade: viagem.capacidade,
    pessoasConfirmadas,
    vagasRestantes: Math.max(0, viagem.capacidade - pessoasConfirmadas),
    // Embarque conta pessoas (titular + acompanhante), como a ocupação.
    pessoasEmbarcadas: contarPessoas(confirmadas.filter((i) => i.embarcadoEm !== null)),
  };
}

async function auditarInscricao(
  acao: 'create' | 'update',
  id: string,
  ator: Ator,
  meta: RequestMeta,
  dadosDepois?: Prisma.InputJsonValue,
) {
  await recordAuditLog({ acao, entidade: 'inscricao', entidadeId: id, userId: ator.userId, ip: meta.ip, dadosDepois });
}

const STATUS_ABERTOS_PARA_INSCRICAO: readonly string[] = ['inscricoes', 'confirmada'];

export async function criarInscricao(viagemId: string, input: CriarInscricaoInput, ator: Ator, meta: RequestMeta) {
  const viagem = await garantirViagem(viagemId);

  if (!STATUS_ABERTOS_PARA_INSCRICAO.includes(viagem.status)) {
    throw new AppError(
      400,
      'VIAGEM_FORA_DO_PERIODO_DE_INSCRICAO',
      'A viagem precisa estar em "inscrições" ou "confirmada" para receber novas inscrições',
    );
  }

  const existente = await findInscricaoPorClienteEViagem(viagemId, input.clienteId);
  if (existente) {
    throw new AppError(409, 'CLIENTE_JA_INSCRITO', 'Este cliente já está inscrito nesta viagem');
  }

  if (input.status === 'confirmada') {
    const confirmadas = await listInscricoesConfirmadasParaOcupacao(viagemId);
    const pessoasAtuais = contarPessoas(confirmadas);
    const pessoasNovas = 1 + (input.levaAcompanhante ? 1 : 0);
    if (pessoasAtuais + pessoasNovas > viagem.capacidade) {
      throw new AppError(
        400,
        'CAPACIDADE_EXCEDIDA',
        'A viagem atingiu a capacidade máxima — inscreva em lista de espera',
      );
    }
  }

  const valorTotal =
    input.valorTotal ??
    Number(viagem.precoTitular) + (input.levaAcompanhante ? Number(viagem.precoAcompanhante ?? 0) : 0);

  const inscricao = await comTravaDeCapacidade(() => createInscricao(viagemId, {
    clienteId: input.clienteId,
    levaAcompanhante: input.levaAcompanhante,
    nomeAcompanhante: input.nomeAcompanhante,
    docAcompanhante: input.docAcompanhante,
    seguroViagem: input.seguroViagem,
    seguradora: input.seguradora,
    numeroApolice: input.numeroApolice,
    valorTotal,
    status: input.status,
  }));

  await auditarInscricao('create', inscricao.id, ator, meta, {
    clienteId: input.clienteId,
    status: input.status,
    levaAcompanhante: input.levaAcompanhante,
  });

  return toInscricaoDTO(inscricao);
}

export async function garantirInscricao(id: string) {
  const inscricao = await findInscricaoByIdOrNull(id);
  if (!inscricao) throw notFound();
  return inscricao;
}

export async function garantirInscricaoEditavel(id: string) {
  const inscricao = await garantirInscricao(id);
  if (inscricao.status === 'cancelada') {
    throw new AppError(409, 'INSCRICAO_CANCELADA', 'Não é possível editar uma inscrição cancelada');
  }
  return inscricao;
}

export async function atualizarInscricao(
  id: string,
  input: AtualizarInscricaoInput,
  ator: Ator,
  meta: RequestMeta,
) {
  await garantirInscricaoEditavel(id);

  const atualizada = await comTravaDeCapacidade(() => updateInscricao(id, input));
  await auditarInscricao('update', id, ator, meta, { ...input });
  return toInscricaoDTO(atualizada);
}

export async function cancelarInscricao(id: string, input: CancelarInscricaoInput, ator: Ator, meta: RequestMeta) {
  const inscricao = await findInscricaoByIdOrNull(id);
  if (!inscricao) throw notFound();
  if (inscricao.status === 'cancelada') {
    throw new AppError(400, 'JA_CANCELADA', 'Inscrição já está cancelada');
  }

  const cancelada = await cancelarInscricaoRepo(id);
  // Pagamentos já registrados não são tocados — o saldo pago em excesso vira
  // um "a devolver" que o financeiro do P10 enxerga pela diferença entre o
  // valor pago histórico e o status cancelado da inscrição.
  await auditarInscricao('update', id, ator, meta, {
    statusAnterior: inscricao.status,
    statusNovo: 'cancelada',
    motivo: input.motivo,
  });

  return toInscricaoDTO(cancelada);
}

/** Embarque só faz sentido para inscrição confirmada de viagem em andamento. */
const STATUS_VIAGEM_PARA_EMBARQUE = new Set(['inscricoes', 'confirmada']);

export async function marcarEmbarque(id: string, input: EmbarqueInput, ator: Ator, meta: RequestMeta) {
  const inscricao = await garantirInscricao(id);
  if (inscricao.status !== 'confirmada') {
    throw new AppError(409, 'INSCRICAO_NAO_CONFIRMADA', 'Só inscrições confirmadas podem embarcar');
  }
  if (!STATUS_VIAGEM_PARA_EMBARQUE.has(inscricao.viagem.status)) {
    throw new AppError(409, 'VIAGEM_SEM_EMBARQUE', 'O embarque só pode ser marcado em viagem confirmada ou com inscrições abertas');
  }

  // Idempotente: marcar de novo não troca o horário do primeiro embarque.
  const embarcadoEm = input.embarcado ? (inscricao.embarcadoEm ?? input.em ?? new Date()) : null;
  const atualizada = await marcarEmbarqueRepo(id, embarcadoEm);
  await auditarInscricao('update', id, ator, meta, {
    embarque: input.embarcado ? 'embarcou' : 'desfeito',
    embarcadoEm: embarcadoEm?.toISOString() ?? null,
    ...(input.em && { sincronizadoDepois: true }),
  });
  return toInscricaoDTO(atualizada);
}
