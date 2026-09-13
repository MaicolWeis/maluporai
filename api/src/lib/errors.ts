export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (msg = 'Recurso não encontrado') => new AppError(404, 'NOT_FOUND', msg);
export const unauthorized = (msg = 'Não autenticado') => new AppError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'Sem permissão') => new AppError(403, 'FORBIDDEN', msg);
export const badRequest = (msg = 'Requisição inválida') => new AppError(400, 'BAD_REQUEST', msg);
