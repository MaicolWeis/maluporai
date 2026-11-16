import { Prisma, type Despesa } from '@prisma/client';
import { AppError, notFound } from '../lib/errors.js';
import { recordAuditLog } from '../repositories/audit-log.repository.js';
import {
  createDespesa,
  deleteDespesa,
  findDespesaByIdOrNull,
  listDespesasPorViagem,
  updateDespesa,
} from '../repositories/despesa.repository.js';
import { findTenantWithSettings } from '../repositories/tenant.repository.js';
import type { AtualizarDespesaInput, CriarDespesaInput } from '../schemas/despesas.schema.js';
import { removerArquivoSeNosso } from './uploads.service.js';
import { garantirViagem } from './viagens.service.js';

interface Ator {
  userId: string;
  tenantId: string;
}

interface RequestMeta {
  ip?: string;
}

function toDespesaDTO(despesa: Despesa) {
  return {
    id: despesa.id,
    viagemId: despesa.viagemId,
    categoria: despesa.categoria,
    descricao: despesa.descricao,
    valor: despesa.valor,
    dataDespesa: despesa.dataDespesa,
    comprovanteUrl: despesa.comprovanteUrl,
    createdAt: despesa.createdAt,
  };
}

async function obterCategoriasValidas(tenantId: string): Promise<string[]> {
  const { settings } = await findTenantWithSettings(tenantId);
  return (settings?.categoriasDespesa as string[] | undefined) ?? [];
}

/**
 * Remover uma categoria nas configurações não apaga despesas antigas (P4):
 * ela só deixa de ser aceita em lançamentos novos ou em trocas de categoria.
 */
async function validarCategoria(tenantId: string, categoria: string) {
  const validas = await obterCategoriasValidas(tenantId);
  if (!validas.includes(categoria)) {
    throw new AppError(
      400,
      'CATEGORIA_DESPESA_INVALIDA',
      `Categoria inválida. Categorias aceitas: ${validas.join(', ')}`,
    );
  }
}

/** Lista de referência pro form — acessível a quem tem "despesas", não só admin. */
export async function listarCategorias(tenantId: string) {
  return obterCategoriasValidas(tenantId);
}

export async function listarDespesasDaViagem(viagemId: string) {
  await garantirViagem(viagemId);
  const despesas = await listDespesasPorViagem(viagemId);

  const porCategoria = new Map<string, Prisma.Decimal>();
  let total = new Prisma.Decimal(0);
  for (const d of despesas) {
    total = total.add(d.valor);
    porCategoria.set(d.categoria, (porCategoria.get(d.categoria) ?? new Prisma.Decimal(0)).add(d.valor));
  }

  return {
    despesas: despesas.map(toDespesaDTO),
    total,
    totalPorCategoria: [...porCategoria.entries()]
      .map(([categoria, valor]) => ({ categoria, total: valor }))
      .sort((a, b) => b.total.comparedTo(a.total)),
  };
}

export async function criarDespesa(viagemId: string, input: CriarDespesaInput, ator: Ator, meta: RequestMeta) {
  await garantirViagem(viagemId);
  await validarCategoria(ator.tenantId, input.categoria);

  const despesa = await createDespesa(viagemId, input);

  await recordAuditLog({
    acao: 'create',
    entidade: 'despesa',
    entidadeId: despesa.id,
    userId: ator.userId,
    ip: meta.ip,
    dadosDepois: {
      viagemId,
      categoria: input.categoria,
      descricao: input.descricao,
      valor: input.valor,
    } as Prisma.InputJsonValue,
  });

  return toDespesaDTO(despesa);
}

export async function atualizarDespesa(id: string, input: AtualizarDespesaInput, ator: Ator, meta: RequestMeta) {
  const atual = await findDespesaByIdOrNull(id);
  if (!atual) throw notFound();

  if (input.categoria !== undefined && input.categoria !== atual.categoria) {
    await validarCategoria(ator.tenantId, input.categoria);
  }

  const despesa = await updateDespesa(id, input);

  await recordAuditLog({
    acao: 'update',
    entidade: 'despesa',
    entidadeId: id,
    userId: ator.userId,
    ip: meta.ip,
    dadosDepois: { ...input } as Prisma.InputJsonValue,
  });

  return toDespesaDTO(despesa);
}

export async function excluirDespesa(id: string, ator: Ator, meta: RequestMeta) {
  const despesa = await findDespesaByIdOrNull(id);
  if (!despesa) throw notFound();

  await deleteDespesa(id);
  await removerArquivoSeNosso(despesa.comprovanteUrl, ator.tenantId);

  await recordAuditLog({
    acao: 'delete',
    entidade: 'despesa',
    entidadeId: id,
    userId: ator.userId,
    ip: meta.ip,
    dadosDepois: {
      viagemId: despesa.viagemId,
      categoria: despesa.categoria,
      descricao: despesa.descricao,
      valor: despesa.valor.toString(),
    } as Prisma.InputJsonValue,
  });
}
