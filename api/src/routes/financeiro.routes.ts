import { z } from 'zod';
import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/errors.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { tenantContext } from '../middlewares/tenantContext.js';
import * as aniversariantesService from '../services/aniversariantes.service.js';
import * as mapaService from '../services/mapa.service.js';
import * as financeiroService from '../services/financeiro.service.js';

/** Aninhado em /viagens/:viagemId/financeiro (ver app.ts). */
export const financeiroViagemRouter = Router({ mergeParams: true });
financeiroViagemRouter.use(requireAuth, tenantContext, requirePermission('viagens'));
financeiroViagemRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ financeiro: await financeiroService.financeiroDaViagem(req.params.viagemId) });
  }),
);

/** GET /dashboard — visão consolidada do tenant (home autenticada). */
export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, tenantContext, requirePermission('viagens'));
dashboardRouter.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await financeiroService.dashboard());
  }),
);

const mesSchema = z.object({ mes: z.coerce.number().int().min(1).max(12).optional() });

/** GET /dashboard/aniversariantes?mes=1..12 — clientes que fazem aniversário no mês (padrão: mês atual). */
dashboardRouter.get(
  '/aniversariantes',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = mesSchema.safeParse(req.query);
    if (!parsed.success) throw new AppError(400, 'MES_INVALIDO', 'Mês inválido (use 1 a 12)');
    const { mes } = parsed.data;
    res.json(await aniversariantesService.aniversariantesDoMes(mes));
  }),
);

/** GET /mapa — clientes por cidade e destinos das viagens, para o mapa da visão geral. */
export const mapaRouter = Router();
mapaRouter.use(requireAuth, tenantContext, requirePermission('viagens'));
mapaRouter.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await mapaService.dadosDoMapa());
  }),
);
