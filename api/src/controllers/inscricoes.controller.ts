import type { Request, Response } from 'express';
import * as inscricoesService from '../services/inscricoes.service.js';

function ator(req: Request) {
  return { userId: req.auth!.userId };
}
function meta(req: Request) {
  return { ip: req.ip };
}

export async function listarPorViagem(req: Request, res: Response) {
  const data = await inscricoesService.listarInscricoesDaViagem(req.params.viagemId);
  res.json(data);
}

export async function criar(req: Request, res: Response) {
  const inscricao = await inscricoesService.criarInscricao(req.params.viagemId, req.body, ator(req), meta(req));
  res.status(201).json({ inscricao });
}

export async function atualizar(req: Request, res: Response) {
  const inscricao = await inscricoesService.atualizarInscricao(req.params.id, req.body, ator(req), meta(req));
  res.json({ inscricao });
}

export async function cancelar(req: Request, res: Response) {
  const inscricao = await inscricoesService.cancelarInscricao(req.params.id, req.body, ator(req), meta(req));
  res.json({ inscricao });
}
