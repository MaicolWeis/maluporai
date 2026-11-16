import { z } from 'zod';

const statusEnum = z.enum(['planejamento', 'inscricoes', 'confirmada', 'concluida', 'cancelada', 'arquivada']);

export const listarViagensQuerySchema = z.object({
  status: statusEnum.optional(),
  // Período da viagem: traz as viagens que acontecem (ao menos em parte)
  // entre dataInicio e dataFim.
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
  // Arquivadas ficam fora da listagem padrão; entram com incluirArquivadas=true
  // ou filtrando status=arquivada.
  incluirArquivadas: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

const viagemBaseSchema = z.object({
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  destinoCidade: z.string().trim().min(1, 'Destino é obrigatório'),
  // Brasil: UF de 2 letras (obrigatória). Fora: estado/província livre, opcional.
  destinoUf: z.string().trim().min(1).max(60).nullable().optional(),
  destinoPais: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'País inválido'),
  dataInicio: z.coerce.date(),
  dataFim: z.coerce.date(),
  capacidade: z.coerce.number().int().min(1, 'Capacidade deve ser ao menos 1'),
  precoTitular: z.coerce.number().min(0),
  precoAcompanhante: z.coerce.number().min(0).optional(),
  descricao: z.string().optional(),
});

const MSG_DATAS = 'A data final não pode ser anterior à data de início';

/** Só compara quando as duas datas vêm no payload; a edição parcial é checada no service. */
function datasEmOrdem(inicio?: Date, fim?: Date) {
  return !inicio || !fim || fim >= inicio;
}

/** No Brasil a UF é obrigatória e tem 2 letras; fora, o estado é livre. */
function ufValidaParaPais(pais?: string, uf?: string | null) {
  if (pais === undefined) return uf === undefined || uf === null || /^[A-Za-z]{2}$/.test(uf);
  if (pais !== 'BR') return true;
  return !!uf && /^[A-Za-z]{2}$/.test(uf);
}
const MSG_UF = 'Informe a UF (2 letras) para destinos no Brasil';

export const criarViagemSchema = viagemBaseSchema
  .extend({ destinoPais: viagemBaseSchema.shape.destinoPais.default('BR') })
  .refine((v) => datasEmOrdem(v.dataInicio, v.dataFim), { message: MSG_DATAS, path: ['dataFim'] })
  .refine((v) => ufValidaParaPais(v.destinoPais, v.destinoUf), { message: MSG_UF, path: ['destinoUf'] })
  .transform((v) => ({ ...v, destinoUf: v.destinoUf ? (v.destinoPais === 'BR' ? v.destinoUf.toUpperCase() : v.destinoUf) : null }));

export const atualizarViagemSchema = viagemBaseSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Informe ao menos um campo' })
  .refine((v) => datasEmOrdem(v.dataInicio, v.dataFim), { message: MSG_DATAS, path: ['dataFim'] })
  // Edição: país e UF andam juntos quando o destino muda (checado no service contra o salvo).
  .transform((v) =>
    v.destinoUf && (v.destinoPais === 'BR' || (v.destinoPais === undefined && v.destinoUf.length === 2))
      ? { ...v, destinoUf: v.destinoUf.toUpperCase() }
      : v,
  );

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
export const criarHotelSchema = hotelBaseSchema.refine((v) => datasEmOrdem(v.checkIn, v.checkOut), {
  message: 'O check-out não pode ser anterior ao check-in',
  path: ['checkOut'],
});
export const atualizarHotelSchema = hotelBaseSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Informe ao menos um campo' })
  .refine((v) => datasEmOrdem(v.checkIn, v.checkOut), {
    message: 'O check-out não pode ser anterior ao check-in',
    path: ['checkOut'],
  });

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
