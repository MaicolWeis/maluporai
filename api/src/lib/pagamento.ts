import { Prisma } from '@prisma/client';

export type StatusPagamento = 'pago' | 'parcial' | 'pendente';

export function somarPagamentos(pagamentos: { valor: Prisma.Decimal }[]): Prisma.Decimal {
  return pagamentos.reduce((soma, p) => soma.add(p.valor), new Prisma.Decimal(0));
}

/**
 * Status derivado, nunca guardado (observação de modelagem da seção 2):
 * sum(pagamentos) vs valor_total → pago/parcial/pendente. Centralizado aqui
 * porque P5 (histórico do cliente) e P7 (inscrições) precisam do mesmo
 * cálculo, e o P8 (pagamentos) vai alimentar os dois via a mesma tabela.
 */
export function derivarStatusPagamento(valorTotal: Prisma.Decimal, valorPago: Prisma.Decimal): StatusPagamento {
  if (valorPago.gte(valorTotal)) return 'pago';
  if (valorPago.gt(0)) return 'parcial';
  return 'pendente';
}
