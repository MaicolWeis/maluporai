import { Router } from 'express';
import * as configuracoesController from '../controllers/configuracoes.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { tenantContext } from '../middlewares/tenantContext.js';
import { validate } from '../middlewares/validate.js';
import { atualizarEmpresaSchema, atualizarPreferenciasSchema } from '../schemas/configuracoes.schema.js';

export const configuracoesRouter = Router();

// Só admin (módulo "configuracoes" — ver src/policies), mesmo padrão de
// /usuarios do P3: requireAuth popula req.auth, tenantContext propaga
// tenant_id pro AsyncLocalStorage, requirePermission checa via can().
configuracoesRouter.use(requireAuth, tenantContext, requirePermission('configuracoes'));

configuracoesRouter.get('/', asyncHandler(configuracoesController.obter));
configuracoesRouter.patch(
  '/empresa',
  validate(atualizarEmpresaSchema),
  asyncHandler(configuracoesController.atualizarEmpresa),
);
configuracoesRouter.patch(
  '/preferencias',
  validate(atualizarPreferenciasSchema),
  asyncHandler(configuracoesController.atualizarPreferencias),
);
