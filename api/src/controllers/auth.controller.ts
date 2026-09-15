import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import * as authService from '../services/auth.service.js';
import type { SessionResult } from '../services/auth.service.js';

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/auth',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  };
}

function sendSession(res: Response, session: SessionResult) {
  res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, refreshCookieOptions());
  res.json({ accessToken: session.accessToken, user: session.user });
}

export async function signup(req: Request, res: Response) {
  const session = await authService.signup(req.body, { ip: req.ip });
  res.status(201);
  sendSession(res, session);
}

export async function login(req: Request, res: Response) {
  const session = await authService.login(req.body, { ip: req.ip });
  sendSession(res, session);
}

export async function refresh(req: Request, res: Response) {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!rawToken) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Sessão inválida, faça login novamente' } });
  }

  try {
    const session = await authService.refreshSession(rawToken, { ip: req.ip });
    sendSession(res, session);
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  await authService.logout(rawToken);
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });
  res.status(204).send();
}

export async function esqueciSenha(req: Request, res: Response) {
  await authService.requestPasswordReset(req.body.email);
  // Resposta idêntica exista ou não o e-mail.
  res.json({ message: 'Se o e-mail existir em nossa base, enviaremos as instruções de redefinição.' });
}

export async function redefinirSenha(req: Request, res: Response) {
  await authService.resetPassword(req.body);
  res.json({ message: 'Senha redefinida com sucesso. Faça login novamente.' });
}

export async function ativarConta(req: Request, res: Response) {
  await authService.activateAccount(req.body);
  res.json({ message: 'Conta ativada com sucesso. Faça login para continuar.' });
}
