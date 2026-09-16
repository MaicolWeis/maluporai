import type { Request, Response } from 'express';
import * as viagensService from '../services/viagens.service.js';
import type { ListarViagensQuery } from '../schemas/viagens.schema.js';

function ator(req: Request) {
  return { userId: req.auth!.userId };
}
function meta(req: Request) {
  return { ip: req.ip };
}

export async function listar(req: Request, res: Response) {
  const data = await viagensService.listarViagens(req.query as unknown as ListarViagensQuery);
  res.json(data);
}

export async function obter(req: Request, res: Response) {
  const viagem = await viagensService.obterViagem(req.params.id);
  res.json({ viagem });
}

export async function criar(req: Request, res: Response) {
  const viagem = await viagensService.criarViagem(req.body, ator(req), meta(req));
  res.status(201).json({ viagem });
}

export async function atualizar(req: Request, res: Response) {
  const viagem = await viagensService.atualizarViagem(req.params.id, req.body, ator(req), meta(req));
  res.json({ viagem });
}

export async function atualizarStatus(req: Request, res: Response) {
  const viagem = await viagensService.atualizarStatusViagem(req.params.id, req.body, ator(req), meta(req));
  res.json({ viagem });
}

export async function excluir(req: Request, res: Response) {
  await viagensService.excluirViagem(req.params.id, ator(req), meta(req));
  res.status(204).send();
}

// ---------------------------------------------------------------------------
// Hotéis
// ---------------------------------------------------------------------------

export async function criarHotel(req: Request, res: Response) {
  const hotel = await viagensService.criarHotel(req.params.viagemId, req.body);
  res.status(201).json({ hotel });
}

export async function atualizarHotel(req: Request, res: Response) {
  const hotel = await viagensService.atualizarHotel(req.params.viagemId, req.params.id, req.body);
  res.json({ hotel });
}

export async function excluirHotel(req: Request, res: Response) {
  await viagensService.excluirHotel(req.params.viagemId, req.params.id);
  res.status(204).send();
}

// ---------------------------------------------------------------------------
// Atrações
// ---------------------------------------------------------------------------

export async function criarAtracao(req: Request, res: Response) {
  const atracao = await viagensService.criarAtracao(req.params.viagemId, req.body);
  res.status(201).json({ atracao });
}

export async function atualizarAtracao(req: Request, res: Response) {
  const atracao = await viagensService.atualizarAtracao(req.params.viagemId, req.params.id, req.body);
  res.json({ atracao });
}

export async function excluirAtracao(req: Request, res: Response) {
  await viagensService.excluirAtracao(req.params.viagemId, req.params.id);
  res.status(204).send();
}

// ---------------------------------------------------------------------------
// Inclusos
// ---------------------------------------------------------------------------

export async function criarIncluso(req: Request, res: Response) {
  const incluso = await viagensService.criarIncluso(req.params.viagemId, req.body);
  res.status(201).json({ incluso });
}

export async function atualizarIncluso(req: Request, res: Response) {
  const incluso = await viagensService.atualizarIncluso(req.params.viagemId, req.params.id, req.body);
  res.json({ incluso });
}

export async function excluirIncluso(req: Request, res: Response) {
  await viagensService.excluirIncluso(req.params.viagemId, req.params.id);
  res.status(204).send();
}
