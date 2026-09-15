import { z } from 'zod';

export const atualizarEmpresaSchema = z
  .object({
    nomeFantasia: z.string().trim().min(2, 'Nome fantasia inválido').optional(),
    razaoSocial: z.string().trim().min(2, 'Razão social inválida').nullable().optional(),
    documento: z.string().trim().min(11, 'Documento inválido').optional(),
    emailContato: z.string().trim().toLowerCase().email('E-mail inválido').optional(),
    telefone: z.string().trim().min(8, 'Telefone inválido').nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Informe ao menos um campo' });

export const atualizarPreferenciasSchema = z
  .object({
    logoUrl: z.string().trim().url('URL inválida').nullable().optional(),
    corPrimaria: z.string().trim().min(1).nullable().optional(),
    formasPagamento: z.array(z.string().trim().min(1)).optional(),
    categoriasDespesa: z.array(z.string().trim().min(1)).optional(),
    textoTermoInscricao: z.string().nullable().optional(),
    prazoRetencaoDadosMeses: z.coerce
      .number()
      .int('Prazo de retenção deve ser um número inteiro de meses')
      .min(12, 'Prazo mínimo de retenção é 12 meses')
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Informe ao menos um campo' });

export type AtualizarEmpresaInput = z.infer<typeof atualizarEmpresaSchema>;
export type AtualizarPreferenciasInput = z.infer<typeof atualizarPreferenciasSchema>;
