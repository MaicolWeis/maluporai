import type { Pagamento, Prisma } from '@prisma/client';
import { AppError, notFound } from '../lib/errors.js';
import { somarPagamentos } from '../lib/pagamento.js';
import { recordAuditLog } from '../repositories/audit-log.repository.js';
import {
  createPagamento,
  deletePagamento,
  findPagamentoByIdOrNull,
  listPagamentosPorInscricao,
} from '../repositories/pagamento.repository.js';
import { findTenantWithSettings } from '../repositories/tenant.repository.js';
import { garantirInscricao, garantirInscricaoEditavel } from './inscricoes.service.js';
import type { CriarPagamentoInput, ExcluirPagamentoInput } from '../schemas/pagamentos.schema.js';

interface Ator {
  userId: string;
  tenantId: string;
}

interface RequestMeta {
  ip?: string;
}

function toPagamentoDTO(pagamento: Pagamento) {
  return {
    id: pagamento.id,
    inscricaoId: pagamento.inscricaoId,
    valor: pagamento.valor,
    forma: pagamento.forma,
    parcelas: pagamento.parcelas,
    dataPagamento: pagamento.dataPagamento,
    comprovanteUrl: pagamento.comprovanteUrl,
    observacoes: pagamento.observacoes,
    createdAt: pagamento.createdAt,
  };
}

async function obterFormasPagamentoValidas(tenantId: string): Promise<string[]> {
  const { settings } = await findTenantWithSettings(tenantId);
  return (settings?.formasPagamento as string[] | undefined) ?? [];
}

/** Lista de referência pro form de registro — acessível a quem tem "pagamentos", não só admin. */
export async function listarFormasPagamento(tenantId: string) {
  return obterFormasPagamentoValidas(tenantId);
}

export async function listarPagamentosDaInscricao(inscricaoId: string) {
  await garantirInscricao(inscricaoId);
  const pagamentos = await listPagamentosPorInscricao(inscricaoId);
  return pagamentos.map(toPagamentoDTO);
}

export async function criarPagamento(inscricaoId: string, input: CriarPagamentoInput, ator: Ator, meta: RequestMeta) {
  const inscricao = await garantirInscricaoEditavel(inscricaoId);

  const formasValidas = await obterFormasPagamentoValidas(ator.tenantId);
  if (!formasValidas.includes(input.forma)) {
    throw new AppError(
      400,
      'FORMA_PAGAMENTO_INVALIDA',
      `Forma de pagamento inválida. Formas aceitas: ${formasValidas.join(', ')}`,
    );
  }

  const existentes = await listPagamentosPorInscricao(inscricaoId);
  const totalPago = somarPagamentos(existentes);
  const novoTotal = totalPago.add(input.valor);
  if (novoTotal.gt(inscricao.valorTotal) && !input.ajusteFinanceiro) {
    throw new AppError(
      400,
      'EXCEDE_VALOR_TOTAL',
      'A soma dos pagamentos excederia o valor total da inscrição — use o ajuste explícito se for intencional',
    );
  }

  const pagamento = await createPagamento(inscricaoId, {
    valor: input.valor,
    forma: input.forma,
    parcelas: input.parcelas,
    dataPagamento: input.dataPagamento,
    observacoes: input.observacoes,
  });

  await recordAuditLog({
    acao: 'create',
    entidade: 'pagamento',
    entidadeId: pagamento.id,
    userId: ator.userId,
    ip: meta.ip,
    dadosDepois: {
      inscricaoId,
      valor: input.valor,
      forma: input.forma,
      ajusteFinanceiro: input.ajusteFinanceiro,
    } as Prisma.InputJsonValue,
  });

  return toPagamentoDTO(pagamento);
}

export async function excluirPagamento(id: string, input: ExcluirPagamentoInput, ator: Ator, meta: RequestMeta) {
  const pagamento = await findPagamentoByIdOrNull(id);
  if (!pagamento) throw notFound();

  await deletePagamento(id);

  await recordAuditLog({
    acao: 'delete',
    entidade: 'pagamento',
    entidadeId: id,
    userId: ator.userId,
    ip: meta.ip,
    dadosDepois: {
      motivo: input.motivo,
      inscricaoId: pagamento.inscricaoId,
      valor: pagamento.valor.toString(),
      forma: pagamento.forma,
    } as Prisma.InputJsonValue,
  });
}
