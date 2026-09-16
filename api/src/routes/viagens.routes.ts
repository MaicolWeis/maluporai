import { Router } from 'express';
import * as viagensController from '../controllers/viagens.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { tenantContext } from '../middlewares/tenantContext.js';
import { validate } from '../middlewares/validate.js';
import {
  atualizarAtracaoSchema,
  atualizarHotelSchema,
  atualizarInclusoSchema,
  atualizarStatusViagemSchema,
  atualizarViagemSchema,
  criarAtracaoSchema,
  criarHotelSchema,
  criarInclusoSchema,
  criarViagemSchema,
  listarViagensQuerySchema,
} from '../schemas/viagens.schema.js';

export const viagensRouter = Router();

viagensRouter.use(requireAuth, tenantContext);
// Módulo "viagens": admin e operador (ver src/policies).
viagensRouter.use(requirePermission('viagens'));

viagensRouter.get('/', validate(listarViagensQuerySchema, 'query'), asyncHandler(viagensController.listar));
viagensRouter.get('/:id', asyncHandler(viagensController.obter));
viagensRouter.post('/', validate(criarViagemSchema), asyncHandler(viagensController.criar));
viagensRouter.patch('/:id', validate(atualizarViagemSchema), asyncHandler(viagensController.atualizar));
viagensRouter.patch(
  '/:id/status',
  validate(atualizarStatusViagemSchema),
  asyncHandler(viagensController.atualizarStatus),
);
viagensRouter.delete('/:id', asyncHandler(viagensController.excluir));

// Hotéis
viagensRouter.post(
  '/:viagemId/hoteis',
  validate(criarHotelSchema),
  asyncHandler(viagensController.criarHotel),
);
viagensRouter.patch(
  '/:viagemId/hoteis/:id',
  validate(atualizarHotelSchema),
  asyncHandler(viagensController.atualizarHotel),
);
viagensRouter.delete('/:viagemId/hoteis/:id', asyncHandler(viagensController.excluirHotel));

// Atrações
viagensRouter.post(
  '/:viagemId/atracoes',
  validate(criarAtracaoSchema),
  asyncHandler(viagensController.criarAtracao),
);
viagensRouter.patch(
  '/:viagemId/atracoes/:id',
  validate(atualizarAtracaoSchema),
  asyncHandler(viagensController.atualizarAtracao),
);
viagensRouter.delete('/:viagemId/atracoes/:id', asyncHandler(viagensController.excluirAtracao));

// Inclusos
viagensRouter.post(
  '/:viagemId/inclusos',
  validate(criarInclusoSchema),
  asyncHandler(viagensController.criarIncluso),
);
viagensRouter.patch(
  '/:viagemId/inclusos/:id',
  validate(atualizarInclusoSchema),
  asyncHandler(viagensController.atualizarIncluso),
);
viagensRouter.delete('/:viagemId/inclusos/:id', asyncHandler(viagensController.excluirIncluso));
