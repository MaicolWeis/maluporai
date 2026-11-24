import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { runWithTenant } from '../lib/tenant-context.js';
import { ConsoleEmailDriver, ResendEmailDriver, type EmailDriver } from './email.service.js';
import { hojeBrasil } from './financeiro.service.js';

/**
 * Verificação diária da plataforma (07:00 BRT), enviada por e-mail ao dono
 * (RELATORIO_EMAIL). Confere banco e armazenamento — a consulta ao Supabase
 * Storage também conta como uso e evita que o projeto gratuito seja pausado
 * por inatividade — e resume o uso das últimas 24 h por empresa.
 *
 * Conteúdo mínimo: contagens e nomes de usuários do sistema (não de clientes).
 */

interface Checagem {
  nome: string;
  ok: boolean;
  detalhe: string;
}

interface ResumoEmpresa {
  empresa: string;
  usuariosAtivos: number;
  clientes: number;
  viagensAtivas: number;
  viagensProximos7Dias: number;
  aniversariantesHoje: number;
  logins: { nome: string; vezes: number }[];
  acoes: Record<string, number>;
}

export interface RelatorioVerificacao {
  geradoEm: Date;
  checagens: Checagem[];
  empresas: ResumoEmpresa[];
  falhasEmpresas: number;
}

const DIA_MS = 24 * 60 * 60 * 1000;

async function cronometrar<T>(fn: () => Promise<T>) {
  const inicio = Date.now();
  const valor = await fn();
  return { valor, ms: Date.now() - inicio };
}

async function checarBanco(): Promise<Checagem> {
  try {
    const { valor, ms } = await cronometrar(() => prisma.tenant.count());
    return { nome: 'Banco de dados', ok: true, detalhe: `respondeu em ${ms} ms (${valor} empresa(s))` };
  } catch (err) {
    return { nome: 'Banco de dados', ok: false, detalhe: (err as Error).message.slice(0, 200) };
  }
}

/** Lista os buckets do Supabase Storage (é também o "keep-alive" do projeto). */
async function checarArmazenamento(): Promise<Checagem> {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { nome: 'Armazenamento (Supabase)', ok: false, detalhe: 'não configurado' };
  }
  try {
    const { valor: res, ms } = await cronometrar(() =>
      fetch(`${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/bucket`, {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          ...(SUPABASE_SERVICE_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } : {}),
        },
        signal: AbortSignal.timeout(15000),
      }),
    );
    if (!res.ok) return { nome: 'Armazenamento (Supabase)', ok: false, detalhe: `HTTP ${res.status}` };
    const buckets = (await res.json()) as { id: string }[];
    const nomes = buckets.map((b) => b.id).sort();
    const faltando = ['comprovantes', 'logos'].filter((b) => !nomes.includes(b));
    return {
      nome: 'Armazenamento (Supabase)',
      ok: faltando.length === 0,
      detalhe: faltando.length
        ? `buckets ausentes: ${faltando.join(', ')}`
        : `respondeu em ${ms} ms (buckets: ${nomes.join(', ')})`,
    };
  } catch (err) {
    const e = err as Error & { cause?: { code?: string } };
    return {
      nome: 'Armazenamento (Supabase)',
      ok: false,
      detalhe: `inacessível (${e.cause?.code ?? e.message}) — o projeto pode ter sido pausado`,
    };
  }
}

async function resumirEmpresa(tenantId: string, nomeEmpresa: string, agora: Date): Promise<ResumoEmpresa> {
  const desde = new Date(agora.getTime() - DIA_MS);
  const hoje = hojeBrasil(agora);
  const em7Dias = new Date(hoje.getTime() + 7 * DIA_MS);

  return runWithTenant(tenantId, async () => {
    const [usuarios, clientes, viagensAtivas, proximas, nascimentos, auditoria] = await Promise.all([
      prisma.user.findMany({ select: { id: true, nome: true, status: true } }),
      prisma.cliente.count({ where: { anonimizadoEm: null } }),
      prisma.viagem.count({ where: { status: { in: ['planejamento', 'inscricoes', 'confirmada'] } } }),
      prisma.viagem.count({
        where: { status: { in: ['inscricoes', 'confirmada'] }, dataInicio: { gte: hoje, lte: em7Dias } },
      }),
      prisma.cliente.findMany({
        where: { anonimizadoEm: null, dataNascimento: { not: null } },
        select: { dataNascimento: true },
      }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: desde } },
        select: { acao: true, userId: true },
      }),
    ]);

    const nomePorId = new Map(usuarios.map((u) => [u.id, u.nome]));
    const logins = new Map<string, number>();
    const acoes: Record<string, number> = {};
    for (const a of auditoria) {
      acoes[a.acao] = (acoes[a.acao] ?? 0) + 1;
      if (a.acao === 'login' && a.userId) {
        const nome = nomePorId.get(a.userId) ?? 'usuário removido';
        logins.set(nome, (logins.get(nome) ?? 0) + 1);
      }
    }

    return {
      empresa: nomeEmpresa,
      usuariosAtivos: usuarios.filter((u) => u.status === 'ativo').length,
      clientes,
      viagensAtivas,
      viagensProximos7Dias: proximas,
      aniversariantesHoje: nascimentos.filter(
        (c) =>
          c.dataNascimento!.getUTCMonth() === hoje.getUTCMonth() && c.dataNascimento!.getUTCDate() === hoje.getUTCDate(),
      ).length,
      logins: [...logins.entries()].map(([nome, vezes]) => ({ nome, vezes })).sort((a, b) => b.vezes - a.vezes),
      acoes,
    };
  });
}

export async function gerarRelatorio(agora = new Date()): Promise<RelatorioVerificacao> {
  const checagens = [
    { nome: 'API', ok: true, detalhe: `no ar (versão em execução desde ${new Date(Date.now() - process.uptime() * 1000).toISOString()})` },
    await checarBanco(),
    await checarArmazenamento(),
  ];

  const empresas: ResumoEmpresa[] = [];
  let falhasEmpresas = 0;
  if (checagens[1].ok) {
    const tenants = await prisma.tenant.findMany({
      where: { status: 'ativo' },
      select: { id: true, nomeFantasia: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const t of tenants) {
      try {
        empresas.push(await resumirEmpresa(t.id, t.nomeFantasia, agora));
      } catch (err) {
        falhasEmpresas += 1;
        logger.error({ err, tenantId: t.id }, '[verificacao] falha ao resumir empresa');
      }
    }
  }
  return { geradoEm: agora, checagens, empresas, falhasEmpresas };
}

const ROTULO_ACAO: Record<string, string> = {
  login: 'logins',
  create: 'criações',
  update: 'alterações',
  delete: 'exclusões',
  consulta: 'consultas de ficha',
  export: 'exportações',
  anonimizacao: 'anonimizações',
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function montarEmail(r: RelatorioVerificacao) {
  const tudoOk = r.checagens.every((c) => c.ok) && r.falhasEmpresas === 0;
  const data = r.geradoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  const dia = r.geradoEm.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const subject = `${tudoOk ? '✅' : '⚠️'} maluporai — verificação diária ${dia}${tudoOk ? '' : ' — atenção'}`;

  const linhasChecagem = r.checagens
    .map(
      (c) =>
        `<tr><td style="padding:4px 8px">${c.ok ? '✅' : '❌'}</td><td style="padding:4px 8px"><strong>${esc(c.nome)}</strong></td><td style="padding:4px 8px;color:#475569">${esc(c.detalhe)}</td></tr>`,
    )
    .join('');

  const blocosEmpresas = r.empresas
    .map((e) => {
      const acoes = Object.entries(e.acoes)
        .map(([k, v]) => `${v} ${ROTULO_ACAO[k] ?? k}`)
        .join(' · ');
      const logins = e.logins.length
        ? e.logins.map((l) => `${esc(l.nome)} (${l.vezes}×)`).join(', ')
        : 'ninguém entrou nas últimas 24 h';
      return `<div style="border:1px solid #E2E8F0;border-radius:8px;padding:12px;margin:8px 0">
        <p style="margin:0 0 6px;font-weight:600">${esc(e.empresa)}</p>
        <p style="margin:0;color:#475569;font-size:13px">${e.usuariosAtivos} usuário(s) ativo(s) · ${e.clientes} cliente(s) · ${e.viagensAtivas} viagem(ns) ativa(s) · ${e.viagensProximos7Dias} saindo nos próximos 7 dias${e.aniversariantesHoje ? ` · 🎂 ${e.aniversariantesHoje} aniversariante(s) hoje` : ''}</p>
        <p style="margin:6px 0 0;font-size:13px"><strong>Entraram:</strong> ${logins}</p>
        <p style="margin:2px 0 0;font-size:13px"><strong>Atividade 24 h:</strong> ${acoes || 'nenhuma'}</p>
      </div>`;
    })
    .join('');

  const html = `<div style="font-family:Inter,Arial,sans-serif;color:#0F172A;max-width:640px">
    <h2 style="margin:0 0 4px;color:#1C69D4">maluporai — verificação diária</h2>
    <p style="margin:0 0 12px;color:#64748B;font-size:13px">${esc(data)} (horário de Brasília)</p>
    <table style="border-collapse:collapse;font-size:14px;margin-bottom:12px">${linhasChecagem}</table>
    ${r.falhasEmpresas ? `<p style="color:#B91C1C">Falha ao resumir ${r.falhasEmpresas} empresa(s) — ver logs do Railway.</p>` : ''}
    <h3 style="margin:16px 0 4px;font-size:15px">Uso nas últimas 24 h</h3>
    ${blocosEmpresas || '<p style="color:#64748B">Sem dados (banco indisponível).</p>'}
    <p style="margin-top:16px;color:#94A3B8;font-size:11px">Enviado automaticamente pela API do maluporai às 07:00. A consulta ao armazenamento também mantém o projeto do Supabase ativo.</p>
  </div>`;
  return { subject, html };
}

function driverDoRelatorio(): EmailDriver {
  if (env.RESEND_API_KEY) {
    return new ResendEmailDriver(env.RESEND_API_KEY, env.RELATORIO_FROM ?? 'maluporai <onboarding@resend.dev>');
  }
  return new ConsoleEmailDriver();
}

export async function executarVerificacao(agora = new Date(), driver: EmailDriver = driverDoRelatorio()) {
  const relatorio = await gerarRelatorio(agora);
  const falhas = relatorio.checagens.filter((c) => !c.ok).map((c) => c.nome);
  logger.info({ falhas, empresas: relatorio.empresas.length }, '[verificacao] verificação diária concluída');
  if (env.RELATORIO_EMAIL) {
    const { subject, html } = montarEmail(relatorio);
    await driver.send({ to: env.RELATORIO_EMAIL, subject, html });
  }
  return relatorio;
}

/** 07:00 BRT (10:00 UTC) todo dia, no processo da API. Só em produção. */
export function agendarVerificacaoDiaria() {
  if (env.NODE_ENV !== 'production') return;
  const proxima = () => {
    const agora = new Date();
    const alvo = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 10, 0, 0));
    if (alvo <= agora) alvo.setUTCDate(alvo.getUTCDate() + 1);
    return alvo.getTime() - agora.getTime();
  };
  const agendar = () => {
    setTimeout(async () => {
      await executarVerificacao().catch((err) => logger.error({ err }, '[verificacao] erro na rotina'));
      agendar();
    }, proxima()).unref();
  };
  agendar();
  if (env.VERIFICACAO_AO_INICIAR === 'true') {
    // Para testar o envio logo após um deploy (desligar depois).
    setTimeout(() => {
      executarVerificacao().catch((err) => logger.error({ err }, '[verificacao] erro na verificação inicial'));
    }, 15000).unref();
  }
  logger.info('[verificacao] verificação diária agendada (07:00 BRT)');
}
