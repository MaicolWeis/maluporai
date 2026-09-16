import type { Request, Response } from 'express';
import * as clientesService from '../services/clientes.service.js';
import type { ListarClientesQuery } from '../schemas/clientes.schema.js';

export async function listar(req: Request, res: Response) {
  const data = await clientesService.listarClientes(req.query as unknown as ListarClientesQuery);
  res.json(data);
}

export async function obter(req: Request, res: Response) {
  const cliente = await clientesService.obterCliente(req.params.id);
  res.json({ cliente });
}

export async function revelarCpf(req: Request, res: Response) {
  const data = await clientesService.revelarCpf(req.params.id, { userId: req.auth!.userId }, { ip: req.ip });
  res.json(data);
}

export async function criar(req: Request, res: Response) {
  const cliente = await clientesService.criarCliente(req.body, { userId: req.auth!.userId }, { ip: req.ip });
  res.status(201).json({ cliente });
}

export async function atualizar(req: Request, res: Response) {
  const cliente = await clientesService.atualizarCliente(
    req.params.id,
    req.body,
    { userId: req.auth!.userId },
    { ip: req.ip },
  );
  res.json({ cliente });
}

export async function excluir(req: Request, res: Response) {
  await clientesService.excluirCliente(req.params.id, { userId: req.auth!.userId }, { ip: req.ip });
  res.status(204).send();
}

export async function anonimizar(req: Request, res: Response) {
  const cliente = await clientesService.anonimizarCliente(
    req.params.id,
    req.body,
    { userId: req.auth!.userId },
    { ip: req.ip },
  );
  res.json({ cliente });
}

export async function exportar(req: Request, res: Response) {
  const dados = await clientesService.exportarDadosCliente(req.params.id, { userId: req.auth!.userId }, { ip: req.ip });
  res.json(dados);
}
