import { Prisma, type Cliente, type InscricaoStatus, type PagamentoForma } from '@prisma/client';
import { AppError, notFound, unauthorized } from '../lib/errors.js';
import { decryptField, encryptField, hashForLookup } from '../lib/crypto.js';
import { maskCpf } from '../lib/cpf.js';
import { derivarStatusPagamento, somarPagamentos } from '../lib/pagamento.js';
import { verifyPassword } from '../lib/password.js';
import { recordAuditLog } from '../repositories/audit-log.repository.js';
import {
  anonimizarClienteRepo,
  countClientes,
  countInscricoesDoCliente,
  createCliente,
  deleteCliente,
  findClienteByIdOrNull,
  findClienteComHistorico,
  listClientes,
  updateCliente,
} from '../repositories/cliente.repository.js';
import { findUserById } from '../repositories/user.repository.js';
import type {
  AnonimizarClienteInput,
  AtualizarClienteInput,
  CriarClienteInput,
  ListarClientesQuery,
} from '../schemas/clientes.schema.js';

interface Ator {
  userId: string;
}

interface RequestMeta {
  ip?: string;
}

function toListItemDTO(cliente: {
  id: string;
  nome: string;
  telefone: string;
  cidade: string | null;
  uf: string | null;
  consentimentoMarketing: boolean;
  anonimizadoEm: Date | null;
  inscricoes: { viagem: { id: string; nome: string } }[];
}) {
  return {
    id: cliente.id,
    nome: cliente.nome,
    telefone: cliente.telefone,
    cidade: cliente.cidade,
    uf: cliente.uf,
    consentimentoMarketing: cliente.consentimentoMarketing,
    anonimizadoEm: cliente.anonimizadoEm,
    viagens: cliente.inscricoes.map((i) => i.viagem),
  };
}

/** Nunca inclui cpf/cpfHash cru — só a versão mascarada, calculada aqui. */
function toDetailDTO(cliente: Cliente) {
  return {
    id: cliente.id,
    nome: cliente.nome,
    telefone: cliente.telefone,
    email: cliente.email,
    cidade: cliente.cidade,
    uf: cliente.uf,
    dataNascimento: cliente.dataNascimento,
    contatoEmergenciaNome: cliente.contatoEmergenciaNome,
    contatoEmergenciaTelefone: cliente.contatoEmergenciaTelefone,
    observacoes: cliente.observacoes,
    consentimentoMarketing: cliente.consentimentoMarketing,
    consentimentoEm: cliente.consentimentoEm,
    anonimizadoEm: cliente.anonimizadoEm,
    createdAt: cliente.createdAt,
    updatedAt: cliente.updatedAt,
    cpfMascarado: cliente.cpf ? maskCpf(decryptField(cliente.cpf)) : null,
  };
}

export async function listarClientes(query: ListarClientesQuery) {
  const skip = (query.pagina - 1) * query.porPagina;
  const filtro = { busca: query.busca, comInscricaoAtiva: query.comInscricaoAtiva };

  const [clientes, total] = await Promise.all([
    listClientes({ ...filtro, skip, take: query.porPagina }),
    countClientes(filtro),
  ]);

  return {
    clientes: clientes.map(toListItemDTO),
    paginacao: {
      pagina: query.pagina,
      porPagina: query.porPagina,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / query.porPagina)),
    },
  };
}

function toInscricaoResumoDTO(inscricao: {
  id: string;
  viagem: { id: string; nome: string; destinoCidade: string; destinoUf: string };
  status: InscricaoStatus;
  valorTotal: Prisma.Decimal;
  pagamentos: { valor: Prisma.Decimal }[];
  createdAt: Date;
}) {
  const pago = somarPagamentos(inscricao.pagamentos);
  return {
    id: inscricao.id,
    viagem: inscricao.viagem,
    status: inscricao.status,
    valorTotal: inscricao.valorTotal,
    valorPago: pago,
    statusPagamento: derivarStatusPagamento(inscricao.valorTotal, pago),
    createdAt: inscricao.createdAt,
  };
}

export async function obterCliente(id: string) {
  const cliente = await findClienteComHistorico(id);
  if (!cliente) throw notFound();
  return {
    ...toDetailDTO(cliente),
    inscricoes: cliente.inscricoes.map(toInscricaoResumoDTO),
  };
}

/** CPF em texto pleno — só aqui, e sempre auditado (seção 3: dado mais sensível do sistema). */
export async function revelarCpf(id: string, ator: Ator, meta: RequestMeta) {
  const cliente = await findClienteByIdOrNull(id);
  if (!cliente) throw notFound();
  if (!cliente.cpf) {
    throw new AppError(404, 'CPF_NAO_CADASTRADO', 'Cliente não tem CPF cadastrado');
  }

  const cpf = decryptField(cliente.cpf);
  await recordAuditLog({
    acao: 'export',
    entidade: 'cliente_cpf',
    entidadeId: id,
    userId: ator.userId,
    ip: meta.ip,
  });
  return { cpf };
}

export async function criarCliente(input: CriarClienteInput, ator: Ator, meta: RequestMeta) {
  const consentimentoMarketing = input.consentimentoMarketing ?? false;

  const cliente = await createCliente({
    nome: input.nome,
    telefone: input.telefone,
    cpf: input.cpf ? encryptField(input.cpf) : undefined,
    cpfHash: input.cpf ? hashForLookup(input.cpf) : undefined,
    email: input.email,
    cidade: input.cidade,
    uf: input.uf,
    dataNascimento: input.dataNascimento,
    contatoEmergenciaNome: input.contatoEmergenciaNome,
    contatoEmergenciaTelefone: input.contatoEmergenciaTelefone,
    observacoes: input.observacoes,
    consentimentoMarketing,
    consentimentoEm: consentimentoMarketing ? new Date() : undefined,
  });

  await recordAuditLog({
    acao: 'create',
    entidade: 'cliente',
    entidadeId: cliente.id,
    userId: ator.userId,
    ip: meta.ip,
    dadosDepois: { nome: input.nome, telefone: input.telefone, temCpf: !!input.cpf },
  });

  return toDetailDTO(cliente);
}

export async function atualizarCliente(
  id: string,
  input: AtualizarClienteInput,
  ator: Ator,
  meta: RequestMeta,
) {
  const existente = await findClienteByIdOrNull(id);
  if (!existente) throw notFound();

  const { cpf, consentimentoMarketing, ...resto } = input;
  const data: Parameters<typeof updateCliente>[1] = { ...resto };

  if (cpf !== undefined) {
    data.cpf = encryptField(cpf);
    data.cpfHash = hashForLookup(cpf);
  }
  if (consentimentoMarketing !== undefined) {
    data.consentimentoMarketing = consentimentoMarketing;
    data.consentimentoEm = consentimentoMarketing ? new Date() : null;
  }

  const atualizado = await updateCliente(id, data);

  await recordAuditLog({
    acao: 'update',
    entidade: 'cliente',
    entidadeId: id,
    userId: ator.userId,
    ip: meta.ip,
    dadosDepois: { ...resto, temCpfAlterado: cpf !== undefined },
  });

  return toDetailDTO(atualizado);
}

export async function excluirCliente(id: string, ator: Ator, meta: RequestMeta) {
  const cliente = await findClienteByIdOrNull(id);
  if (!cliente) throw notFound();

  const totalInscricoes = await countInscricoesDoCliente(id);
  if (totalInscricoes > 0) {
    throw new AppError(
      409,
      'CLIENTE_COM_INSCRICAO',
      'Cliente possui inscrições e não pode ser excluído — use a anonimização em Privacidade',
    );
  }

  await deleteCliente(id);
  await recordAuditLog({ acao: 'delete', entidade: 'cliente', entidadeId: id, userId: ator.userId, ip: meta.ip });
}

/**
 * Irreversível: sobrescreve os campos de identificação com valores fixos
 * (nunca criptografados, nunca recuperáveis) — não há "desfazer". Exige a
 * senha do admin logado (não a do cliente) e o nome do cliente digitado de
 * novo, como dupla confirmação de uma ação destrutiva.
 */
export async function anonimizarCliente(
  id: string,
  input: AnonimizarClienteInput,
  ator: Ator,
  meta: RequestMeta,
) {
  const cliente = await findClienteByIdOrNull(id);
  if (!cliente) throw notFound();

  if (cliente.anonimizadoEm) {
    throw new AppError(400, 'JA_ANONIMIZADO', 'Cliente já foi anonimizado');
  }

  if (input.confirmacaoNome.trim() !== cliente.nome.trim()) {
    throw new AppError(400, 'CONFIRMACAO_INVALIDA', 'O nome digitado não confere com o nome do cliente');
  }

  const admin = await findUserById(ator.userId);
  if (!admin.senhaHash || !(await verifyPassword(admin.senhaHash, input.senhaConfirmacao))) {
    throw unauthorized('Senha incorreta');
  }

  const anonimizado = await anonimizarClienteRepo(id, {
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
    userId: ator.userId,
    ip: meta.ip,
  });

  return toDetailDTO(anonimizado);
}

interface DadosExportados {
  cadastro: Omit<ReturnType<typeof toDetailDTO>, 'cpfMascarado'> & { cpf: string | null };
  inscricoes: {
    id: string;
    viagem: { id: string; nome: string; destinoCidade: string; destinoUf: string };
    levaAcompanhante: boolean;
    nomeAcompanhante: string | null;
    seguroViagem: boolean;
    valorTotal: unknown;
    status: InscricaoStatus;
    createdAt: Date;
    pagamentos: { id: string; valor: unknown; forma: PagamentoForma; dataPagamento: Date }[];
  }[];
}

/** LGPD art. 18 — direito de acesso: todos os dados do titular, sem máscara. */
export async function exportarDadosCliente(id: string, ator: Ator, meta: RequestMeta): Promise<DadosExportados> {
  const cliente = await findClienteComHistorico(id);
  if (!cliente) throw notFound();

  const { cpfMascarado: _cpfMascarado, ...cadastroBase } = toDetailDTO(cliente);
  const cadastro = { ...cadastroBase, cpf: cliente.cpf ? decryptField(cliente.cpf) : null };

  const inscricoes = cliente.inscricoes.map((i) => ({
    id: i.id,
    viagem: i.viagem,
    levaAcompanhante: i.levaAcompanhante,
    nomeAcompanhante: i.nomeAcompanhante,
    seguroViagem: i.seguroViagem,
    valorTotal: i.valorTotal,
    status: i.status,
    createdAt: i.createdAt,
    pagamentos: i.pagamentos.map((p) => ({ id: p.id, valor: p.valor, forma: p.forma, dataPagamento: p.dataPagamento })),
  }));

  await recordAuditLog({ acao: 'export', entidade: 'cliente', entidadeId: id, userId: ator.userId, ip: meta.ip });

  return { cadastro, inscricoes };
}
