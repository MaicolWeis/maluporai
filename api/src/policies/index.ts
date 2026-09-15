import type { UserRole } from '@prisma/client';

/**
 * Permissões por papel, centralizadas num único lugar (P3). Hoje é
 * módulo-a-módulo (grosseiro); a evolução para permissões granulares
 * (por ação dentro de um módulo) troca só o Set por regras mais finas
 * aqui dentro — quem chama can()/requirePermission() não muda.
 */
export type Modulo =
  | 'usuarios'
  | 'configuracoes'
  | 'clientes'
  | 'viagens'
  | 'inscricoes'
  | 'pagamentos'
  | 'despesas'
  | 'lgpd_anonimizacao';

const PERMISSOES_POR_PAPEL: Record<UserRole, ReadonlySet<Modulo>> = {
  admin: new Set([
    'usuarios',
    'configuracoes',
    'clientes',
    'viagens',
    'inscricoes',
    'pagamentos',
    'despesas',
    'lgpd_anonimizacao',
  ]),
  operador: new Set(['clientes', 'viagens', 'inscricoes', 'pagamentos', 'despesas']),
};

export function can(papel: UserRole, modulo: Modulo): boolean {
  return PERMISSOES_POR_PAPEL[papel]?.has(modulo) ?? false;
}
