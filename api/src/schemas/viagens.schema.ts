import { z } from 'zod';

const statusEnum = z.enum(['planejamento', 'inscricoes', 'confirmada', 'concluida', 'cancelada']);

export const listarViagensQuerySchema = z.object({
  status: statusEnum.optional(),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

export const criarViagemSchema = z.object({
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  destinoCidade: z.string().trim().min(1, 'Destino é obrigatório'),
  destinoUf: z.string().trim().length(2, 'UF inválida').toUpperCase(),
  dataInicio: z.coerce.date(),
  dataFim: z.coerce.date(),
  capacidade: z.coerce.number().int().min(1, 'Capacidade deve ser ao menos 1'),
  precoTitular: z.coerce.number().min(0),
  precoAcompanhante: z.coerce.number().min(0).optional(),
  descricao: z.string().optional(),
});

export const atualizarViagemSchema = criarViagemSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Informe ao menos um campo' });

export const atualizarStatusViagemSchema = z.object({
  status: statusEnum,
  motivo: z.string().trim().min(1).optional(),
});

const hotelBaseSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório'),
  cidade: z.string().trim().min(1).optional(),
  telefone: z.string().trim().min(8).optional(),
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().optional(),
  valorNegociado: z.coerce.number().min(0).optional(),
  observacoes: z.string().optional(),
});
export const criarHotelSchema = hotelBaseSchema;
export const atualizarHotelSchema = hotelBaseSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Informe ao menos um campo' });

const atracaoTipoEnum = z.enum(['parque', 'passeio', 'refeicao', 'outro']);
const atracaoBaseSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório'),
  tipo: atracaoTipoEnum,
  valorEntrada: z.coerce.number().min(0).optional(),
  incluso: z.boolean().default(false),
  observacoes: z.string().optional(),
});
export const criarAtracaoSchema = atracaoBaseSchema;
export const atualizarAtracaoSchema = atracaoBaseSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Informe ao menos um campo' });

const inclusoBaseSchema = z.object({
  descricao: z.string().trim().min(1, 'Descrição é obrigatória'),
  ordem: z.coerce.number().int().min(0).default(0),
});
export const criarInclusoSchema = inclusoBaseSchema;
export const atualizarInclusoSchema = inclusoBaseSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Informe ao menos um campo' });

export type ListarViagensQuery = z.infer<typeof listarViagensQuerySchema>;
export type CriarViagemInput = z.infer<typeof criarViagemSchema>;
export type AtualizarViagemInput = z.infer<typeof atualizarViagemSchema>;
export type AtualizarStatusViagemInput = z.infer<typeof atualizarStatusViagemSchema>;
export type CriarHotelInput = z.infer<typeof criarHotelSchema>;
export type AtualizarHotelInput = z.infer<typeof atualizarHotelSchema>;
export type CriarAtracaoInput = z.infer<typeof criarAtracaoSchema>;
export type AtualizarAtracaoInput = z.infer<typeof atualizarAtracaoSchema>;
export type CriarInclusoInput = z.infer<typeof criarInclusoSchema>;
export type AtualizarInclusoInput = z.infer<typeof atualizarInclusoSchema>;
