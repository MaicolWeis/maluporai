import { randomUUID } from 'node:crypto';
import type { Prisma, UserRole } from '@prisma/client';
import { AppError, forbidden, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { type Bucket, interpretarReferencia, montarReferencia, storage } from '../lib/storage.js';
import { can, type Modulo } from '../policies/index.js';
import { recordAuditLog } from '../repositories/audit-log.repository.js';

export const TAMANHO_MAXIMO = 5 * 1024 * 1024;
export const URL_ASSINADA_EXPIRA_SEGUNDOS = 10 * 60;

export type Finalidade = 'comprovante_pagamento' | 'comprovante_despesa' | 'logo';

interface Ator {
  userId: string;
  tenantId: string;
  papel: string;
}

interface RequestMeta {
  ip?: string;
}

const TIPOS: { mime: string; ext: string; assinatura: (b: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', ext: 'jpg', assinatura: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    ext: 'png',
    assinatura: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    assinatura: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  { mime: 'application/pdf', ext: 'pdf', assinatura: (b) => b.subarray(0, 5).toString('ascii') === '%PDF-' },
];

/**
 * O tipo é decidido pelos bytes do arquivo, não pelo Content-Type nem pela
 * extensão informados pelo navegador (que o cliente controla).
 */
export function detectarTipo(conteudo: Buffer) {
  return TIPOS.find((t) => t.assinatura(conteudo)) ?? null;
}

interface Alvo {
  bucket: Bucket;
  entidade: string;
  modulo: Modulo;
  aceitaPdf: boolean;
  /** Lê a referência atual (404 se a entidade não existir no tenant — RLS). */
  lerAtual: (entidadeId: string | undefined, tenantId: string) => Promise<string | null>;
  gravar: (entidadeId: string | undefined, tenantId: string, referencia: string | null) => Promise<void>;
}

function exigirId(entidadeId: string | undefined) {
  if (!entidadeId) throw new AppError(400, 'ENTIDADE_OBRIGATORIA', 'Informe a qual registro o arquivo pertence');
  return entidadeId;
}

const ALVOS: Record<Finalidade, Alvo> = {
  comprovante_pagamento: {
    bucket: 'comprovantes',
    entidade: 'pagamento',
    modulo: 'pagamentos',
    aceitaPdf: true,
    async lerAtual(id) {
      const p = await prisma.pagamento.findUnique({ where: { id: exigirId(id) } });
      if (!p) throw notFound();
      return p.comprovanteUrl;
    },
    async gravar(id, _t, referencia) {
      await prisma.pagamento.update({ where: { id: exigirId(id) }, data: { comprovanteUrl: referencia } });
    },
  },
  comprovante_despesa: {
    bucket: 'comprovantes',
    entidade: 'despesa',
    modulo: 'despesas',
    aceitaPdf: true,
    async lerAtual(id) {
      const d = await prisma.despesa.findUnique({ where: { id: exigirId(id) } });
      if (!d) throw notFound();
      return d.comprovanteUrl;
    },
    async gravar(id, _t, referencia) {
      await prisma.despesa.update({ where: { id: exigirId(id) }, data: { comprovanteUrl: referencia } });
    },
  },
  logo: {
    bucket: 'logos',
    entidade: 'logo',
    modulo: 'configuracoes',
    aceitaPdf: false,
    async lerAtual(_id, tenantId) {
      const s = await prisma.tenantSettings.findUnique({ where: { tenantId } });
      return s?.logoUrl ?? null;
    },
    async gravar(_id, tenantId, referencia) {
      await prisma.tenantSettings.update({ where: { tenantId }, data: { logoUrl: referencia } });
    },
  },
};

function alvoComPermissao(finalidade: Finalidade, ator: Ator) {
  const alvo = ALVOS[finalidade];
  if (!can(ator.papel as UserRole, alvo.modulo)) throw forbidden();
  return alvo;
}

/** Remove o arquivo antigo sem derrubar a operação se o Storage falhar. */
export async function removerArquivoSeNosso(referencia: string | null | undefined, tenantId: string) {
  if (!referencia) return;
  const ref = interpretarReferencia(referencia);
  if (!ref || ref.tenantId !== tenantId) return; // ex.: URL externa antiga do logo
  try {
    await storage.remove(ref.bucket, ref.path);
  } catch (err) {
    logger.warn({ err }, 'Falha ao remover arquivo antigo do storage');
  }
}

export async function enviarArquivo(
  finalidade: Finalidade,
  entidadeId: string | undefined,
  arquivo: { buffer: Buffer; size: number },
  ator: Ator,
  meta: RequestMeta,
) {
  const alvo = alvoComPermissao(finalidade, ator);

  if (arquivo.size > TAMANHO_MAXIMO) {
    throw new AppError(400, 'ARQUIVO_GRANDE', 'Arquivo maior que 5 MB');
  }
  const tipo = detectarTipo(arquivo.buffer);
  if (!tipo || (tipo.mime === 'application/pdf' && !alvo.aceitaPdf)) {
    throw new AppError(
      400,
      'TIPO_NAO_SUPORTADO',
      alvo.aceitaPdf ? 'Envie JPG, PNG, WEBP ou PDF' : 'Envie JPG, PNG ou WEBP',
    );
  }

  // Valida a entidade (404 em outro tenant) ANTES de subir qualquer byte.
  const anterior = await alvo.lerAtual(entidadeId, ator.tenantId);

  const referencia = montarReferencia(alvo.bucket, ator.tenantId, alvo.entidade, `${randomUUID()}.${tipo.ext}`);
  const ref = interpretarReferencia(referencia)!;
  await storage.upload(ref.bucket, ref.path, arquivo.buffer, tipo.mime);

  try {
    await alvo.gravar(entidadeId, ator.tenantId, referencia);
  } catch (err) {
    await storage.remove(ref.bucket, ref.path).catch(() => undefined);
    throw err;
  }
  await removerArquivoSeNosso(anterior, ator.tenantId);

  await recordAuditLog({
    acao: 'create',
    entidade: `arquivo_${alvo.entidade}`,
    entidadeId: entidadeId ?? ator.tenantId,
    userId: ator.userId,
    ip: meta.ip,
    dadosDepois: { referencia, tipo: tipo.mime, tamanho: arquivo.size, substituiu: anterior } as Prisma.InputJsonValue,
  });

  return { referencia };
}

export async function removerArquivo(finalidade: Finalidade, entidadeId: string | undefined, ator: Ator, meta: RequestMeta) {
  const alvo = alvoComPermissao(finalidade, ator);
  const anterior = await alvo.lerAtual(entidadeId, ator.tenantId);
  if (!anterior) return;

  await alvo.gravar(entidadeId, ator.tenantId, null);
  await removerArquivoSeNosso(anterior, ator.tenantId);

  await recordAuditLog({
    acao: 'delete',
    entidade: `arquivo_${alvo.entidade}`,
    entidadeId: entidadeId ?? ator.tenantId,
    userId: ator.userId,
    ip: meta.ip,
    dadosDepois: { referencia: anterior } as Prisma.InputJsonValue,
  });
}

/**
 * URL assinada de 10 min. Referência de outro tenant (ou malformada) responde
 * 404 — mesmo critério do resto da API, pra não revelar existência.
 */
export async function urlAssinada(referencia: string, ator: Ator) {
  const ref = interpretarReferencia(referencia);
  if (!ref || ref.tenantId !== ator.tenantId) throw notFound();
  const url = await storage.signedUrl(ref.bucket, ref.path, URL_ASSINADA_EXPIRA_SEGUNDOS);
  return { url, expiraEmSegundos: URL_ASSINADA_EXPIRA_SEGUNDOS };
}
