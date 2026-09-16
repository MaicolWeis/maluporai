import { Router } from 'express';
import * as clientesController from '../controllers/clientes.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { tenantContext } from '../middlewares/tenantContext.js';
import { validate } from '../middlewares/validate.js';
import {
  anonimizarClienteSchema,
  atualizarClienteSchema,
  criarClienteSchema,
  listarClientesQuerySchema,
} from '../schemas/clientes.schema.js';

export const clientesRouter = Router();

clientesRouter.use(requireAuth, tenantContext);

// CRUD normal: admin e operador (módulo "clientes" — ver src/policies).
clientesRouter.get('/', requirePermission('clientes'), validate(listarClientesQuerySchema, 'query'), asyncHandler(clientesController.listar));
clientesRouter.get('/:id', requirePermission('clientes'), asyncHandler(clientesController.obter));
clientesRouter.get('/:id/cpf', requirePermission('clientes'), asyncHandler(clientesController.revelarCpf));
clientesRouter.post('/', requirePermission('clientes'), validate(criarClienteSchema), asyncHandler(clientesController.criar));
clientesRouter.patch('/:id', requirePermission('clientes'), validate(atualizarClienteSchema), asyncHandler(clientesController.atualizar));
clientesRouter.delete('/:id', requirePermission('clientes'), asyncHandler(clientesController.excluir));

// LGPD: só admin (módulo "lgpd_anonimizacao").
clientesRouter.post(
  '/:id/anonimizar',
  requirePermission('lgpd_anonimizacao'),
  validate(anonimizarClienteSchema),
  asyncHandler(clientesController.anonimizar),
);
clientesRouter.get('/:id/exportar', requirePermission('lgpd_anonimizacao'), asyncHandler(clientesController.exportar));
