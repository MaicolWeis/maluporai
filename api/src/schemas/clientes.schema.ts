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
  uf: z.string().trim().length(2, 'UF inválida').toUpperCase().optional(),
  dataNascimento: z.coerce.date().optional(),
  contatoEmergenciaNome: z.string().trim().min(1).optional(),
  contatoEmergenciaTelefone: z.string().trim().min(8).optional(),
  observacoes: z.string().optional(),
  // Sem .default() de propósito: o schema de update deriva deste via
  // .partial(), e um default aqui "vazaria" pro PATCH parcial sempre que
  // o campo não for enviado, resetando consentimento existente pra
  // false. O default (false) na criação é aplicado no service.
  consentimentoMarketing: z.boolean().optional(),
});

export const atualizarClienteSchema = criarClienteSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Informe ao menos um campo' });

export const anonimizarClienteSchema = z.object({
  senhaConfirmacao: z.string().min(1, 'Informe sua senha para confirmar'),
  confirmacaoNome: z.string().min(1, 'Digite o nome do cliente para confirmar'),
});

export type ListarClientesQuery = z.infer<typeof listarClientesQuerySchema>;
export type CriarClienteInput = z.infer<typeof criarClienteSchema>;
export type AtualizarClienteInput = z.infer<typeof atualizarClienteSchema>;
export type AnonimizarClienteInput = z.infer<typeof anonimizarClienteSchema>;
