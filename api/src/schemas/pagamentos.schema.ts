import { z } from 'zod';

export const criarPagamentoSchema = z
  .object({
    valor: z.coerce.number().positive('Valor deve ser positivo'),
    forma: z.string().trim().min(1, 'Informe a forma de pagamento'),
    parcelas: z.coerce.number().int().min(1).optional(),
    dataPagamento: z.coerce.date(),
    observacoes: z.string().trim().optional(),
    // Único jeito de passar de valor_total: exige motivo registrado em
    // observações, pra manter rastreável por que a soma excedeu.
    ajusteFinanceiro: z.boolean().default(false),
  })
  .refine((v) => !v.ajusteFinanceiro || (v.observacoes && v.observacoes.length > 0), {
    message: 'Registre o motivo do ajuste em observações',
    path: ['observacoes'],
  });

export const excluirPagamentoSchema = z.object({
  motivo: z.string().trim().min(1, 'Informe o motivo da exclusão'),
});

export type CriarPagamentoInput = z.infer<typeof criarPagamentoSchema>;
export type ExcluirPagamentoInput = z.infer<typeof excluirPagamentoSchema>;
