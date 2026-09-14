import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Express 4 não propaga rejeições de handlers async — encaminha pro errorHandler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
