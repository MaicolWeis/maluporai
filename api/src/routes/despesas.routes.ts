import { Router } from 'express';
import * as despesasController from '../controllers/despesas.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { tenantContext } from '../middlewares/tenantContext.js';
import { validate } from '../middlewares/validate.js';
import { atualizarDespesaSchema, criarDespesaSchema } from '../schemas/despesas.schema.js';

/** Aninhado em /viagens/:viagemId/despesas (ver app.ts). */
export const despesasPorViagemRouter = Router({ mergeParams: true });
despesasPorViagemRouter.use(requireAuth, tenantContext, requirePermission('despesas'));
despesasPorViagemRouter.get('/', asyncHandler(despesasController.listarPorViagem));
despesasPorViagemRouter.post('/', validate(criarDespesaSchema), asyncHandler(despesasController.criar));

/** Recurso de topo em /despesas. */
export const despesasRouter = Router();
despesasRouter.use(requireAuth, tenantContext, requirePermission('despesas'));
despesasRouter.get('/categorias', asyncHandler(despesasController.listarCategorias));
despesasRouter.patch('/:id', validate(atualizarDespesaSchema), asyncHandler(despesasController.atualizar));
despesasRouter.delete('/:id', asyncHandler(despesasController.excluir));
