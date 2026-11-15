// Formatação de exibição (pt-BR).

const moedaBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** "R$ 1.234,56". Aceita string decimal da API (Prisma Decimal) ou número. */
export function formatBRL(valor: string | number | null | undefined): string {
  if (valor == null || valor === '') return '—';
  const n = Number(valor);
  return Number.isFinite(n) ? moedaBRL.format(n) : '—';
}

/**
 * Data "de calendário" (data_inicio, data_pagamento, check-in...). A API
 * devolve meia-noite UTC ("2026-12-12T00:00:00.000Z"); passar isso por
 * new Date() + toLocaleDateString em UTC-3 mostraria o dia anterior. Aqui
 * usamos só a parte AAAA-MM-DD, sem fuso.
 */
export function formatDataCivil(valor: string | null | undefined): string {
  if (!valor) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

/** Hoje no fuso do navegador, no formato AAAA-MM-DD (valor de <input type="date">). */
export function hojeLocalISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}
