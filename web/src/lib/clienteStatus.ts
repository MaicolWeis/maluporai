export type ClienteStatus = 'ativo' | 'inativo' | 'bloqueado';

export const CLIENTE_STATUS_LABEL: Record<ClienteStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  bloqueado: 'Bloqueado',
};

export const CLIENTE_STATUS_PILL: Record<ClienteStatus, string> = {
  ativo: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  inativo: 'bg-slate-100 text-slate-600 border border-slate-200',
  bloqueado: 'bg-red-50 text-red-700 border border-red-200',
};
