import type { Request, Response } from 'express';
import * as configuracoesService from '../services/configuracoes.service.js';

export async function obter(req: Request, res: Response) {
  const data = await configuracoesService.obterConfiguracoes(req.auth!.tenantId);
  res.json(data);
}

export async function atualizarEmpresa(req: Request, res: Response) {
  const tenant = await configuracoesService.atualizarEmpresa(
    req.auth!.tenantId,
    req.body,
    { userId: req.auth!.userId },
    { ip: req.ip },
  );
  res.json({ tenant });
}

export async function atualizarPreferencias(req: Request, res: Response) {
  const configuracoes = await configuracoesService.atualizarPreferencias(
    req.auth!.tenantId,
    req.body,
    { userId: req.auth!.userId },
    { ip: req.ip },
  );
  res.json({ configuracoes });
}
