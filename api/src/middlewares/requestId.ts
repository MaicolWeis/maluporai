import type { NextFunction, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  req.id = (req.headers['x-request-id'] as string) ?? uuid();
  res.setHeader('x-request-id', req.id);
  next();
}
