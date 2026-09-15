import { recordAuditLog } from '../repositories/audit-log.repository.js';
import {
  findTenantWithSettings,
  updateTenantEmpresa,
  updateTenantPreferencias,
} from '../repositories/tenant.repository.js';
import type { AtualizarEmpresaInput, AtualizarPreferenciasInput } from '../schemas/configuracoes.schema.js';

interface Ator {
  userId: string;
}

interface RequestMeta {
  ip?: string;
}

function toEmpresaDTO(tenant: {
  id: string;
  nomeFantasia: string;
  razaoSocial: string | null;
  documento: string;
  emailContato: string;
  telefone: string | null;
  plano: string;
  status: string;
}) {
  return {
    id: tenant.id,
    nomeFantasia: tenant.nomeFantasia,
    razaoSocial: tenant.razaoSocial,
    documento: tenant.documento,
    emailContato: tenant.emailContato,
    telefone: tenant.telefone,
    plano: tenant.plano,
    status: tenant.status,
  };
}

function toPreferenciasDTO(settings: {
  logoUrl: string | null;
  corPrimaria: string | null;
  formasPagamento: unknown;
  categoriasDespesa: unknown;
  textoTermoInscricao: string | null;
  prazoRetencaoDadosMeses: number;
}) {
  return {
    logoUrl: settings.logoUrl,
    corPrimaria: settings.corPrimaria,
    formasPagamento: settings.formasPagamento,
    categoriasDespesa: settings.categoriasDespesa,
    textoTermoInscricao: settings.textoTermoInscricao,
    prazoRetencaoDadosMeses: settings.prazoRetencaoDadosMeses,
  };
}

export async function obterConfiguracoes(tenantId: string) {
  const tenant = await findTenantWithSettings(tenantId);
  return {
    tenant: toEmpresaDTO(tenant),
    configuracoes: tenant.settings ? toPreferenciasDTO(tenant.settings) : null,
  };
}

export async function atualizarEmpresa(
  tenantId: string,
  input: AtualizarEmpresaInput,
  ator: Ator,
  meta: RequestMeta,
) {
  const updated = await updateTenantEmpresa(tenantId, input);
  await recordAuditLog({
    acao: 'update',
    entidade: 'tenant',
    entidadeId: tenantId,
    userId: ator.userId,
    ip: meta.ip,
    dadosDepois: input,
  });
  return toEmpresaDTO(updated);
}

export async function atualizarPreferencias(
  tenantId: string,
  input: AtualizarPreferenciasInput,
  ator: Ator,
  meta: RequestMeta,
) {
  const updated = await updateTenantPreferencias(tenantId, input);
  await recordAuditLog({
    acao: 'update',
    entidade: 'tenant_settings',
    entidadeId: tenantId,
    userId: ator.userId,
    ip: meta.ip,
    dadosDepois: input,
  });
  return toPreferenciasDTO(updated);
}
