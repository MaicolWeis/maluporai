import { Prisma } from '@prisma/client';
import { notFound } from '../lib/errors.js';
import { somarPagamentos } from '../lib/pagamento.js';
import { prisma } from '../lib/prisma.js';

const ZERO = () => new Prisma.Decimal(0);

/** Data de hoje (AAAA-MM-DD) no fuso de operação dos tenants (Brasil). */
export function hojeBrasil(agora = new Date()): Date {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
  return new Date(`${iso}T00:00:00.000Z`);
}

function adicionarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * 24 * 60 * 60 * 1000);
}

type InscricaoComPagamentos = {
  status: string;
  valorTotal: Prisma.Decimal;
  pagamentos: { valor: Prisma.Decimal }[];
};

/**
 * Consolidação financeira de uma viagem (P10). Definições:
 * - receita prevista: soma de valor_total das inscrições confirmadas
 * - recebido: pagamentos de inscrições não canceladas (mesma regra dos agregados do P6)
 * - a receber: saldo em aberto das inscrições confirmadas
 * - a devolver: pagamentos de inscrições canceladas (saldo a devolver do P7)
 * - resultado atual = recebido − despesas; previsto = receita prevista − despesas
 */
export function consolidar(inscricoes: InscricaoComPagamentos[], despesas: { valor: Prisma.Decimal }[]) {
  let receitaPrevista = ZERO();
  let recebido = ZERO();
  let aReceber = ZERO();
  let aDevolver = ZERO();

  for (const i of inscricoes) {
    const pago = somarPagamentos(i.pagamentos);
    if (i.status === 'cancelada') {
      aDevolver = aDevolver.add(pago);
      continue;
    }
    recebido = recebido.add(pago);
    if (i.status === 'confirmada') {
      receitaPrevista = receitaPrevista.add(i.valorTotal);
      const saldo = i.valorTotal.sub(pago);
      if (saldo.gt(0)) aReceber = aReceber.add(saldo);
    }
  }

  const totalDespesas = despesas.reduce((s, d) => s.add(d.valor), ZERO());
  const resultadoAtual = recebido.sub(totalDespesas);
  const resultadoPrevisto = receitaPrevista.sub(totalDespesas);
  const margemPrevista = receitaPrevista.gt(0)
    ? Number(resultadoPrevisto.div(receitaPrevista).mul(100).toDecimalPlaces(1))
    : null;

  return {
    receitaPrevista,
    recebido,
    aReceber,
    despesas: totalDespesas,
    aDevolver,
    resultadoAtual,
    resultadoPrevisto,
    margemPrevista,
  };
}

const INSCRICOES_FINANCEIRO = {
  select: { status: true, valorTotal: true, pagamentos: { select: { valor: true } } },
} as const;

export async function financeiroDaViagem(viagemId: string) {
  const viagem = await prisma.viagem.findUnique({
    where: { id: viagemId },
    include: { inscricoes: INSCRICOES_FINANCEIRO, despesas: { select: { valor: true } } },
  });
  if (!viagem) throw notFound('Viagem não encontrada');
  return consolidar(viagem.inscricoes, viagem.despesas);
}

export async function dashboard(agora = new Date()) {
  const hoje = hojeBrasil(agora);
  const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const inicioProxMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));
  const limitePendencia = adicionarDias(hoje, 30);

  const viagens = await prisma.viagem.findMany({
    // Canceladas e arquivadas não aparecem na visão geral.
    where: { status: { notIn: ['cancelada', 'arquivada'] } },
    orderBy: { dataInicio: 'asc' },
    include: {
      inscricoes: {
        select: {
          id: true,
          status: true,
          levaAcompanhante: true,
          valorTotal: true,
          pagamentos: { select: { valor: true } },
          cliente: { select: { id: true, nome: true, telefone: true } },
        },
      },
      despesas: { select: { valor: true } },
    },
  });

  const proximasViagens = viagens
    .filter((v) => v.status !== 'concluida' && v.dataInicio >= hoje)
    .slice(0, 6)
    .map((v) => {
      const fin = consolidar(v.inscricoes, v.despesas);
      return {
        id: v.id,
        nome: v.nome,
        destinoCidade: v.destinoCidade,
        destinoUf: v.destinoUf,
        destinoPais: v.destinoPais,
        dataInicio: v.dataInicio,
        dataFim: v.dataFim,
        status: v.status,
        capacidade: v.capacidade,
        pessoasConfirmadas: v.inscricoes
          .filter((i) => i.status === 'confirmada')
          .reduce((t, i) => t + 1 + (i.levaAcompanhante ? 1 : 0), 0),
        recebido: fin.recebido,
        aReceber: fin.aReceber,
      };
    });

  let aReceberNoMes = ZERO();
  const pendencias: {
    inscricaoId: string;
    viagemId: string;
    viagemNome: string;
    dataInicio: Date;
    clienteId: string;
    clienteNome: string;
    clienteTelefone: string;
    valorTotal: Prisma.Decimal;
    valorPago: Prisma.Decimal;
    saldo: Prisma.Decimal;
  }[] = [];

  for (const v of viagens) {
    if (v.status === 'concluida') continue;
    for (const i of v.inscricoes) {
      if (i.status !== 'confirmada') continue;
      const pago = somarPagamentos(i.pagamentos);
      const saldo = i.valorTotal.sub(pago);
      if (saldo.lte(0)) continue;

      if (v.dataInicio >= inicioMes && v.dataInicio < inicioProxMes) aReceberNoMes = aReceberNoMes.add(saldo);

      if (v.dataInicio >= hoje && v.dataInicio <= limitePendencia) {
        pendencias.push({
          inscricaoId: i.id,
          viagemId: v.id,
          viagemNome: v.nome,
          dataInicio: v.dataInicio,
          clienteId: i.cliente.id,
          clienteNome: i.cliente.nome,
          clienteTelefone: i.cliente.telefone,
          valorTotal: i.valorTotal,
          valorPago: pago,
          saldo,
        });
      }
    }
  }
  pendencias.sort((a, b) => a.dataInicio.getTime() - b.dataInicio.getTime() || b.saldo.comparedTo(a.saldo));

  // Mais recentes primeiro, limitado pra caber num gráfico legível.
  const resultadoPorViagem = [...viagens]
    .sort((a, b) => b.dataInicio.getTime() - a.dataInicio.getTime())
    .slice(0, 12)
    .reverse()
    .map((v) => {
      const fin = consolidar(v.inscricoes, v.despesas);
      return {
        viagemId: v.id,
        nome: v.nome,
        dataInicio: v.dataInicio,
        recebido: fin.recebido,
        despesas: fin.despesas,
        resultadoAtual: fin.resultadoAtual,
        resultadoPrevisto: fin.resultadoPrevisto,
      };
    });

  return { hoje, aReceberNoMes, proximasViagens, pendencias, resultadoPorViagem };
}
