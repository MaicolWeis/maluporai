import { z } from 'zod';

export const convidarUsuarioSchema = z.object({
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  papel: z.enum(['admin', 'operador']),
});

export const atualizarUsuarioSchema = z
  .object({
    papel: z.enum(['admin', 'operador']).optional(),
    status: z.enum(['ativo', 'inativo']).optional(),
  })
  .refine((v) => v.papel !== undefined || v.status !== undefined, {
    message: 'Informe papel ou status',
  });

export type ConvidarUsuarioInput = z.infer<typeof convidarUsuarioSchema>;
export type AtualizarUsuarioInput = z.infer<typeof atualizarUsuarioSchema>;
