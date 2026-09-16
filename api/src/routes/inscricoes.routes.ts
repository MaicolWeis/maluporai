import { Router } from 'express';
import * as inscricoesController from '../controllers/inscricoes.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { tenantContext } from '../middlewares/tenantContext.js';
import { validate } from '../middlewares/validate.js';
import { atualizarInscricaoSchema, cancelarInscricaoSchema, criarInscricaoSchema } from '../schemas/inscricoes.schema.js';

/** Aninhado em /viagens/:viagemId/inscricoes (ver app.ts). */
export const inscricoesPorViagemRouter = Router({ mergeParams: true });
inscricoesPorViagemRouter.use(requireAuth, tenantContext, requirePermission('inscricoes'));
inscricoesPorViagemRouter.get('/', asyncHandler(inscricoesController.listarPorViagem));
inscricoesPorViagemRouter.post('/', validate(criarInscricaoSchema), asyncHandler(inscricoesController.criar));

/** Recurso de topo em /inscricoes/:id — fora do aninhamento de viagem. */
export const inscricoesRouter = Router();
inscricoesRouter.use(requireAuth, tenantContext, requirePermission('inscricoes'));
inscricoesRouter.patch('/:id', validate(atualizarInscricaoSchema), asyncHandler(inscricoesController.atualizar));
inscricoesRouter.post(
  '/:id/cancelar',
  validate(cancelarInscricaoSchema),
  asyncHandler(inscricoesController.cancelar),
);
