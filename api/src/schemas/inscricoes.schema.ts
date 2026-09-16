import { z } from 'zod';

export const criarInscricaoSchema = z
  .object({
    clienteId: z.string().uuid('Cliente inválido'),
    levaAcompanhante: z.boolean().default(false),
    nomeAcompanhante: z.string().trim().min(1).optional(),
    docAcompanhante: z.string().trim().min(1).optional(),
    seguroViagem: z.boolean().default(false),
    seguradora: z.string().trim().min(1).optional(),
    numeroApolice: z.string().trim().min(1).optional(),
    valorTotal: z.coerce.number().min(0).optional(),
    // Única forma de contornar o bloqueio de capacidade — nunca o default.
    status: z.enum(['confirmada', 'lista_espera']).default('confirmada'),
  })
  .refine((v) => !v.levaAcompanhante || !!v.nomeAcompanhante, {
    message: 'Informe o nome do acompanhante',
    path: ['nomeAcompanhante'],
  });

export const atualizarInscricaoSchema = z
  .object({
    levaAcompanhante: z.boolean().optional(),
    nomeAcompanhante: z.string().trim().min(1).optional(),
    docAcompanhante: z.string().trim().min(1).optional(),
    seguroViagem: z.boolean().optional(),
    seguradora: z.string().trim().min(1).optional(),
    numeroApolice: z.string().trim().min(1).optional(),
    valorTotal: z.coerce.number().min(0).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Informe ao menos um campo' })
  .refine((v) => v.levaAcompanhante !== true || !!v.nomeAcompanhante, {
    message: 'Informe o nome do acompanhante',
    path: ['nomeAcompanhante'],
  });

export const cancelarInscricaoSchema = z.object({
  motivo: z.string().trim().min(1, 'Informe o motivo do cancelamento'),
});

export type CriarInscricaoInput = z.infer<typeof criarInscricaoSchema>;
export type AtualizarInscricaoInput = z.infer<typeof atualizarInscricaoSchema>;
export type CancelarInscricaoInput = z.infer<typeof cancelarInscricaoSchema>;
