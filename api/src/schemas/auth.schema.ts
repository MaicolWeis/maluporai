import { z } from 'zod';
import { isCommonPassword } from '../lib/password.js';

const senhaSchema = z
  .string()
  .min(8, 'Senha deve ter ao menos 8 caracteres')
  .refine((senha) => !isCommonPassword(senha), { message: 'Senha muito comum, escolha outra' });

export const signupSchema = z.object({
  nomeFantasia: z.string().trim().min(2, 'Nome fantasia é obrigatório'),
  documento: z.string().trim().min(11, 'Documento inválido'),
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: senhaSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: z.string().min(1, 'Senha é obrigatória'),
});

export const esqueciSenhaSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
});

export const redefinirSenhaSchema = z.object({
  token: z.string().min(10, 'Token inválido'),
  senha: senhaSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EsqueciSenhaInput = z.infer<typeof esqueciSenhaSchema>;
export type RedefinirSenhaInput = z.infer<typeof redefinirSenhaSchema>;
