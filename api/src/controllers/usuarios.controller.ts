import type { Request, Response } from 'express';
import * as usuariosService from '../services/usuarios.service.js';

export async function listar(_req: Request, res: Response) {
  const usuarios = await usuariosService.listarUsuarios();
  res.json({ usuarios });
}

export async function convidar(req: Request, res: Response) {
  const usuario = await usuariosService.convidarUsuario(req.body, { userId: req.auth!.userId }, { ip: req.ip });
  res.status(201).json({ usuario });
}

export async function atualizar(req: Request, res: Response) {
  const usuario = await usuariosService.atualizarUsuario(
    req.params.id,
    req.body,
    { userId: req.auth!.userId },
    { ip: req.ip },
  );
  res.json({ usuario });
}

export async function excluir(req: Request, res: Response) {
  await usuariosService.excluirUsuario(req.params.id, { userId: req.auth!.userId }, { ip: req.ip });
  res.status(204).send();
}
