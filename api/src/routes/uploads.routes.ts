import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/errors.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { tenantContext } from '../middlewares/tenantContext.js';
import { validate } from '../middlewares/validate.js';
import * as uploadsService from '../services/uploads.service.js';

const FINALIDADES = ['comprovante_pagamento', 'comprovante_despesa', 'logo'] as const;

const alvoSchema = z.object({
  finalidade: z.enum(FINALIDADES),
  entidadeId: z.string().uuid('entidadeId inválido').optional(),
});

const urlAssinadaSchema = z.object({ path: z.string().min(3).max(300) });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadsService.TAMANHO_MAXIMO, files: 1, fields: 5 },
});

/** Converte erros do multer (ex.: arquivo > 5 MB) no formato padrão da API. */
function receberArquivo(req: Request, res: Response, next: NextFunction) {
  upload.single('arquivo')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      return next(
        err.code === 'LIMIT_FILE_SIZE'
          ? new AppError(400, 'ARQUIVO_GRANDE', 'Arquivo maior que 5 MB')
          : new AppError(400, 'UPLOAD_INVALIDO', 'Envio de arquivo inválido'),
      );
    }
    next(err as Error | undefined);
  });
}

function ator(req: Request) {
  return { userId: req.auth!.userId, tenantId: req.auth!.tenantId, papel: req.auth!.papel };
}

export const uploadsRouter = Router();
// Permissão por finalidade é checada no service (pagamentos/despesas/configurações).
uploadsRouter.use(requireAuth, tenantContext);

uploadsRouter.post(
  '/',
  receberArquivo,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new AppError(400, 'ARQUIVO_OBRIGATORIO', 'Envie um arquivo no campo "arquivo"');
    const alvo = alvoSchema.safeParse(req.body);
    if (!alvo.success) throw new AppError(400, 'VALIDATION_ERROR', alvo.error.issues[0]?.message ?? 'Dados inválidos');
    const resultado = await uploadsService.enviarArquivo(
      alvo.data.finalidade,
      alvo.data.entidadeId,
      { buffer: req.file.buffer, size: req.file.size },
      ator(req),
      { ip: req.ip },
    );
    res.status(201).json(resultado);
  }),
);

uploadsRouter.delete(
  '/',
  validate(alvoSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await uploadsService.removerArquivo(req.body.finalidade, req.body.entidadeId, ator(req), { ip: req.ip });
    res.status(204).send();
  }),
);

uploadsRouter.get(
  '/signed-url',
  asyncHandler(async (req: Request, res: Response) => {
    const q = urlAssinadaSchema.safeParse(req.query);
    if (!q.success) throw new AppError(400, 'VALIDATION_ERROR', 'Informe o path');
    res.json(await uploadsService.urlAssinada(q.data.path, ator(req)));
  }),
);
