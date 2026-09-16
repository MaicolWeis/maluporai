import { Router } from 'express';
import * as pagamentosController from '../controllers/pagamentos.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { requireRole } from '../middlewares/requireRole.js';
import { tenantContext } from '../middlewares/tenantContext.js';
import { validate } from '../middlewares/validate.js';
import { criarPagamentoSchema, excluirPagamentoSchema } from '../schemas/pagamentos.schema.js';

/** Aninhado em /inscricoes/:inscricaoId/pagamentos (ver app.ts). */
export const pagamentosPorInscricaoRouter = Router({ mergeParams: true });
pagamentosPorInscricaoRouter.use(requireAuth, tenantContext, requirePermission('pagamentos'));
pagamentosPorInscricaoRouter.get('/', asyncHandler(pagamentosController.listarPorInscricao));
pagamentosPorInscricaoRouter.post('/', validate(criarPagamentoSchema), asyncHandler(pagamentosController.criar));

/**
 * Recurso de topo em /pagamentos. GET /formas é lido por qualquer papel com
 * acesso a "pagamentos" (pro form de registro); DELETE é só admin — regra
 * aplicada na própria rota, não no router inteiro.
 */
export const pagamentosRouter = Router();
pagamentosRouter.use(requireAuth, tenantContext, requirePermission('pagamentos'));
pagamentosRouter.get('/formas', asyncHandler(pagamentosController.listarFormas));
pagamentosRouter.delete(
  '/:id',
  requireRole('admin'),
  validate(excluirPagamentoSchema),
  asyncHandler(pagamentosController.excluir),
);
