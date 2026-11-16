import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { tenantContext } from '../middlewares/tenantContext.js';
import { validate } from '../middlewares/validate.js';

const querySchema = z.object({
  userId: z.string().uuid().optional(),
  entidade: z.string().trim().min(1).max(60).optional(),
  acao: z.enum(['create', 'update', 'delete', 'login', 'export', 'anonimizacao', 'consulta']).optional(),
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

/** GET /auditoria (admin) — trilha de auditoria do tenant, filtrável e paginada. RLS isola por tenant. */
export const auditoriaRouter = Router();
auditoriaRouter.use(requireAuth, tenantContext, requirePermission('auditoria'));

auditoriaRouter.get(
  '/',
  validate(querySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as z.infer<typeof querySchema>;
    const where = {
      ...(q.userId && { userId: q.userId }),
      ...(q.entidade && { entidade: q.entidade }),
      ...(q.acao && { acao: q.acao }),
      ...((q.de || q.ate) && {
        createdAt: {
          ...(q.de && { gte: q.de }),
          // "até" inclusivo: considera o dia inteiro.
          ...(q.ate && { lt: new Date(q.ate.getTime() + 24 * 60 * 60 * 1000) }),
        },
      }),
    };

    const [total, registros, usuarios, entidades] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.user.findMany({ select: { id: true, nome: true, email: true }, orderBy: { nome: 'asc' } }),
      prisma.auditLog.findMany({ distinct: ['entidade'], select: { entidade: true }, orderBy: { entidade: 'asc' } }),
    ]);

    const nomePorId = new Map(usuarios.map((u) => [u.id, u.nome]));
    res.json({
      itens: registros.map((r) => ({
        id: r.id.toString(),
        acao: r.acao,
        entidade: r.entidade,
        entidadeId: r.entidadeId,
        userId: r.userId,
        usuarioNome: r.userId ? (nomePorId.get(r.userId) ?? 'Usuário removido') : 'Sistema',
        dados: r.dadosDepois,
        ip: r.ip,
        createdAt: r.createdAt,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
      filtros: { usuarios, entidades: entidades.map((e) => e.entidade) },
    });
  }),
);
