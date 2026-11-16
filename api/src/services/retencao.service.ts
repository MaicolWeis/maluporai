import type { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { runWithTenant } from '../lib/tenant-context.js';
import { recordAuditLog } from '../repositories/audit-log.repository.js';
import { anonimizarClienteRepo } from '../repositories/cliente.repository.js';
import { emailService } from './email.service.js';
import { hojeBrasil } from './financeiro.service.js';

const DIA_MS = 24 * 60 * 60 * 1000;
export const AVISO_DIAS_ANTES = 30;

/** Viagem "em andamento" mantém o cliente ativo (base legal: execução de contrato). */
const STATUS_VIAGEM_ATIVA = ['planejamento', 'inscricoes', 'confirmada'] as const;

function subtrairMeses(data: Date, meses: number) {
  const d = new Date(data);
  d.setUTCMonth(d.getUTCMonth() - meses);
  return d;
}

/**
 * Clientes elegíveis à anonimização automática (P11):
 * - ainda não anonimizados;
 * - sem inscrição ativa (inscrição não cancelada em viagem que não foi concluída/cancelada);
 * - última atualização do cadastro antes de `limite`.
 */
function whereElegiveis(limite: Date): Prisma.ClienteWhereInput {
  return {
    anonimizadoEm: null,
    updatedAt: { lt: limite },
    inscricoes: {
      none: {
        status: { not: 'cancelada' },
        viagem: { status: { in: [...STATUS_VIAGEM_ATIVA] } },
      },
    },
  };
}

async function processarTenant(tenantId: string, hoje: Date, resumo: ResumoRetencao) {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const prazoMeses = settings?.prazoRetencaoDadosMeses ?? 60;
  const limite = subtrairMeses(hoje, prazoMeses);

  // 1. Anonimiza quem passou do prazo.
  const vencidos = await prisma.cliente.findMany({ where: whereElegiveis(limite), select: { id: true } });
  for (const { id } of vencidos) {
    await anonimizarClienteRepo(id, {
      nome: `Cliente anonimizado ${id.slice(0, 8)}`,
      cpf: null,
      cpfHash: null,
      telefone: 'ANONIMIZADO',
      email: null,
      contatoEmergenciaNome: null,
      contatoEmergenciaTelefone: null,
      anonimizadoEm: new Date(),
    });
    await recordAuditLog({
      acao: 'anonimizacao',
      entidade: 'cliente',
      entidadeId: id,
      dadosDepois: { motivo: 'retencao_automatica', prazoMeses } as Prisma.InputJsonValue,
    });
  }
  resumo.anonimizados += vencidos.length;

  // 2. Aviso ao admin: clientes que completam o prazo daqui a exatos 30 dias.
  //    Janela de um dia => cada cliente gera um único aviso, sem precisar
  //    guardar estado (e sem mexer no updated_at, que é o próprio relógio).
  const inicioJanela = new Date(limite.getTime() + AVISO_DIAS_ANTES * DIA_MS);
  const fimJanela = new Date(inicioJanela.getTime() + DIA_MS);
  const aVencer = await prisma.cliente.count({
    where: { ...whereElegiveis(fimJanela), updatedAt: { gte: inicioJanela, lt: fimJanela } },
  });
  if (aVencer > 0) {
    const admins = await prisma.user.findMany({ where: { papel: 'admin', status: 'ativo' }, select: { email: true } });
    for (const admin of admins) {
      await emailService.send({
        to: admin.email,
        subject: `maluporai: ${aVencer} cliente(s) serão anonimizados em ${AVISO_DIAS_ANTES} dias`,
        html: `<p>Pela política de retenção configurada (${prazoMeses} meses), <strong>${aVencer}</strong> cliente(s) sem inscrição ativa terão os dados pessoais anonimizados em ${AVISO_DIAS_ANTES} dias.</p>
<p>Os valores financeiros são preservados. Se algum desses clientes ainda tiver relação com a sua empresa, atualize o cadastro dele ou inscreva-o numa viagem — isso reinicia o prazo.</p>
<p><a href="${env.FRONTEND_URL}/clientes">Abrir clientes</a> · prazo ajustável em Configurações → Privacidade.</p>`,
      });
    }
    resumo.avisos += aVencer;
  }
}

export interface ResumoRetencao {
  tenants: number;
  anonimizados: number;
  avisos: number;
  falhas: number;
}

/** Rotina diária de retenção LGPD em todos os tenants ativos. */
export async function executarRetencao(agora = new Date()): Promise<ResumoRetencao> {
  const hoje = hojeBrasil(agora);
  const tenants = await prisma.tenant.findMany({ where: { status: 'ativo' }, select: { id: true } });
  const resumo: ResumoRetencao = { tenants: tenants.length, anonimizados: 0, avisos: 0, falhas: 0 };

  for (const t of tenants) {
    try {
      await runWithTenant(t.id, () => processarTenant(t.id, hoje, resumo));
    } catch (err) {
      resumo.falhas += 1;
      logger.error({ err, tenantId: t.id }, '[retencao] falha ao processar tenant');
    }
  }
  logger.info(resumo, '[retencao] rotina diária concluída');
  return resumo;
}

/**
 * Agenda a rotina para 03:00 (horário de Brasília) todo dia, no próprio
 * processo da API (uma réplica só). Desligada fora de produção.
 */
export function agendarRetencaoDiaria() {
  if (env.NODE_ENV !== 'production') return;

  const proximaExecucao = () => {
    const agora = new Date();
    // 03:00 BRT = 06:00 UTC
    const alvo = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 6, 0, 0));
    if (alvo <= agora) alvo.setUTCDate(alvo.getUTCDate() + 1);
    return alvo.getTime() - agora.getTime();
  };

  const agendar = () => {
    setTimeout(async () => {
      await executarRetencao().catch((err) => logger.error({ err }, '[retencao] erro na rotina'));
      agendar();
    }, proximaExecucao()).unref();
  };
  agendar();
  logger.info('[retencao] rotina diária de retenção LGPD agendada (03:00 BRT)');
}
