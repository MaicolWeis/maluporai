import type { Request, Response } from 'express';
import * as pagamentosService from '../services/pagamentos.service.js';

function ator(req: Request) {
  return { userId: req.auth!.userId, tenantId: req.auth!.tenantId };
}
function meta(req: Request) {
  return { ip: req.ip };
}

export async function listarFormas(req: Request, res: Response) {
  const formas = await pagamentosService.listarFormasPagamento(req.auth!.tenantId);
  res.json({ formasPagamento: formas });
}

export async function listarPorInscricao(req: Request, res: Response) {
  const pagamentos = await pagamentosService.listarPagamentosDaInscricao(req.params.inscricaoId);
  res.json({ pagamentos });
}

export async function criar(req: Request, res: Response) {
  const pagamento = await pagamentosService.criarPagamento(req.params.inscricaoId, req.body, ator(req), meta(req));
  res.status(201).json({ pagamento });
}

export async function excluir(req: Request, res: Response) {
  await pagamentosService.excluirPagamento(req.params.id, req.body, ator(req), meta(req));
  res.status(204).send();
}
