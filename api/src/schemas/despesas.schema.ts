import { z } from 'zod';

export const criarDespesaSchema = z.object({
  categoria: z.string().trim().min(1, 'Informe a categoria'),
  descricao: z.string().trim().min(1, 'Informe a descrição').max(200),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  dataDespesa: z.coerce.date(),
});

export const atualizarDespesaSchema = criarDespesaSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nada para atualizar' });

export type CriarDespesaInput = z.infer<typeof criarDespesaSchema>;
export type AtualizarDespesaInput = z.infer<typeof atualizarDespesaSchema>;
