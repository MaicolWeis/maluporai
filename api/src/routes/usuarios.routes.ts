import { Router } from 'express';
import * as usuariosController from '../controllers/usuarios.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { tenantContext } from '../middlewares/tenantContext.js';
import { validate } from '../middlewares/validate.js';
import { atualizarUsuarioSchema, convidarUsuarioSchema } from '../schemas/usuarios.schema.js';

export const usuariosRouter = Router();

// Toda rota de /usuarios exige sessão válida + módulo "usuarios" (só admin
// nesta fase — ver src/policies). requireAuth popula req.auth a partir do
// JWT; tenantContext propaga tenant_id pro AsyncLocalStorage (P1).
usuariosRouter.use(requireAuth, tenantContext, requirePermission('usuarios'));

usuariosRouter.get('/', asyncHandler(usuariosController.listar));
usuariosRouter.post('/convites', validate(convidarUsuarioSchema), asyncHandler(usuariosController.convidar));
usuariosRouter.patch('/:id', validate(atualizarUsuarioSchema), asyncHandler(usuariosController.atualizar));
usuariosRouter.delete('/:id', asyncHandler(usuariosController.excluir));
