import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../lib/errors.js';

type Part = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodSchema, part: Part = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const detail = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      return next(new AppError(400, 'VALIDATION_ERROR', detail));
    }
    req[part] = result.data;
    next();
  };
