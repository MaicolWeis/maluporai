import type { ViagemStatus } from '../types/viagem';

export const STATUS_LABEL: Record<ViagemStatus, string> = {
  planejamento: 'Planejamento',
  inscricoes: 'Inscrições abertas',
  confirmada: 'Confirmada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  arquivada: 'Arquivada',
};

export const STATUS_PILL: Record<ViagemStatus, string> = {
  planejamento: 'bg-slate-50 text-slate-600 border border-slate-200',
  inscricoes: 'bg-amber-50 text-amber-700 border border-amber-200',
  confirmada: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  concluida: 'bg-brand-soft text-brand-ink border border-brand-border',
  cancelada: 'bg-red-50 text-red-700 border border-red-200',
  arquivada: 'bg-slate-100 text-slate-500 border border-slate-300',
};

/** Espelha as transições aceitas pela API (viagens.service). */
export const TRANSICOES_VALIDAS: Record<ViagemStatus, ViagemStatus[]> = {
  planejamento: ['inscricoes', 'cancelada'],
  inscricoes: ['confirmada', 'cancelada'],
  confirmada: ['concluida', 'cancelada'],
  concluida: ['arquivada'],
  cancelada: [],
  arquivada: ['concluida'],
};

/** Texto da opção no seletor "Mudar status". */
export function rotuloTransicao(atual: ViagemStatus, proximo: ViagemStatus) {
  if (proximo === 'arquivada') return 'Arquivar';
  if (atual === 'arquivada' && proximo === 'concluida') return 'Desarquivar';
  return STATUS_LABEL[proximo];
}
