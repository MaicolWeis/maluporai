import type { Request, Response } from 'express';
import * as despesasService from '../services/despesas.service.js';

function ator(req: Request) {
  return { userId: req.auth!.userId, tenantId: req.auth!.tenantId };
}
function meta(req: Request) {
  return { ip: req.ip };
}

export async function listarCategorias(req: Request, res: Response) {
  const categorias = await despesasService.listarCategorias(req.auth!.tenantId);
  res.json({ categoriasDespesa: categorias });
}

export async function listarPorViagem(req: Request, res: Response) {
  const resultado = await despesasService.listarDespesasDaViagem(req.params.viagemId);
  res.json(resultado);
}

export async function criar(req: Request, res: Response) {
  const despesa = await despesasService.criarDespesa(req.params.viagemId, req.body, ator(req), meta(req));
  res.status(201).json({ despesa });
}

export async function atualizar(req: Request, res: Response) {
  const despesa = await despesasService.atualizarDespesa(req.params.id, req.body, ator(req), meta(req));
  res.json({ despesa });
}

export async function excluir(req: Request, res: Response) {
  await despesasService.excluirDespesa(req.params.id, ator(req), meta(req));
  res.status(204).send();
}
