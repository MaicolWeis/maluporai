import { z } from 'zod';

export const listarClientesQuerySchema = z.object({
  busca: z.string().trim().min(1).optional(),
  comInscricaoAtiva: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

const cpfSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 11, { message: 'CPF deve ter 11 dígitos' });

export const criarClienteSchema = z.object({
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  telefone: z.string().trim().min(8, 'Telefone inválido'),
  cpf: cpfSchema.optional(),
  email: z.string().trim().toLowerCase().email('E-mail inválido').optional(),
  cidade: z.string().trim().min(1).optional(),
  // Brasil: UF de 2 letras. Fora: estado/província livre. null limpa na edição.
  uf: z.string().trim().min(1).max(60).nullable().optional(),
  pais: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'País inválido')
    .optional(),
  dataNascimento: z.coerce
    .date()
    .refine((d) => d <= new Date() && d.getUTCFullYear() >= 1900, { message: 'Data de nascimento inválida' })
    .nullable()
    .optional(),
  // Moto do cliente (opcional). null limpa na edição.
  motoMarca: z.string().trim().min(1).max(60).nullable().optional(),
  motoModelo: z.string().trim().min(1).max(80).nullable().optional(),
  contatoEmergenciaNome: z.string().trim().min(1).optional(),
  contatoEmergenciaTelefone: z.string().trim().min(8).optional(),
  observacoes: z.string().optional(),
  // Sem .default() de propósito: o schema de update deriva deste via
  // .partial(), e um default aqui "vazaria" pro PATCH parcial sempre que
  // o campo não for enviado, resetando consentimento existente pra
  // false. O default (false) na criação é aplicado no service.
  consentimentoMarketing: z.boolean().optional(),
});

const MSG_UF = 'UF inválida (use 2 letras para cidades do Brasil)';
/** UF só é validada contra o país quando os dois vêm juntos; senão o service compara com o salvo. */
function ufCoerente(pais: string | undefined, uf: string | null | undefined) {
  if (!uf) return true;
  if ((pais ?? 'BR') !== 'BR') return true;
  return /^[A-Za-z]{2}$/.test(uf);
}
function normalizarUf<T extends { pais?: string; uf?: string | null }>(v: T): T {
  return v.uf && (v.pais ?? 'BR') === 'BR' ? { ...v, uf: v.uf.toUpperCase() } : v;
}

export const criarClienteSchemaValidado = criarClienteSchema
  .refine((v) => ufCoerente(v.pais, v.uf), { message: MSG_UF, path: ['uf'] })
  .transform(normalizarUf);

export const atualizarClienteSchema = criarClienteSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Informe ao menos um campo' })
  .refine((v) => v.pais === undefined || ufCoerente(v.pais, v.uf), { message: MSG_UF, path: ['uf'] })
  .transform(normalizarUf);

export const anonimizarClienteSchema = z.object({
  senhaConfirmacao: z.string().min(1, 'Informe sua senha para confirmar'),
  confirmacaoNome: z.string().min(1, 'Digite o nome do cliente para confirmar'),
});

export type ListarClientesQuery = z.infer<typeof listarClientesQuerySchema>;
export type CriarClienteInput = z.infer<typeof criarClienteSchemaValidado>;
export type AtualizarClienteInput = z.infer<typeof atualizarClienteSchema>;
export type AnonimizarClienteInput = z.infer<typeof anonimizarClienteSchema>;
