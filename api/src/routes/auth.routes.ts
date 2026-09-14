import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { loginRateLimit } from '../middlewares/loginRateLimit.js';
import { validate } from '../middlewares/validate.js';
import {
  esqueciSenhaSchema,
  loginSchema,
  redefinirSenhaSchema,
  signupSchema,
} from '../schemas/auth.schema.js';

export const authRouter = Router();

authRouter.post('/signup', validate(signupSchema), asyncHandler(authController.signup));
authRouter.post('/login', loginRateLimit, validate(loginSchema), asyncHandler(authController.login));
authRouter.post('/refresh', asyncHandler(authController.refresh));
authRouter.post('/logout', asyncHandler(authController.logout));
authRouter.post('/esqueci-senha', validate(esqueciSenhaSchema), asyncHandler(authController.esqueciSenha));
authRouter.post('/redefinir-senha', validate(redefinirSenhaSchema), asyncHandler(authController.redefinirSenha));
