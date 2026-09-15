import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { signAccessToken } from '../src/lib/jwt.js';
import { getCurrentTenantIdOrNull } from '../src/lib/tenant-context.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { requireAuth } from '../src/middlewares/requireAuth.js';
import { requireRole } from '../src/middlewares/requireRole.js';
import { tenantContext } from '../src/middlewares/tenantContext.js';

function buildTestApp() {
  const app = express();
  app.get('/protegido', requireAuth, tenantContext, (req, res) => {
    res.json({ tenantIdNoContexto: getCurrentTenantIdOrNull(), auth: req.auth });
  });
  app.get('/somente-admin', requireAuth, tenantContext, requireRole('admin'), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('requireAuth + tenantContext (composição usada pelas rotas protegidas)', () => {
  const app = buildTestApp();

  it('valida o JWT, popula req.auth e propaga tenant_id pro AsyncLocalStorage', async () => {
    const token = signAccessToken({ sub: 'user-1', tenantId: 'tenant-abc', papel: 'admin' });
    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.tenantIdNoContexto).toBe('tenant-abc');
    expect(res.body.auth).toEqual({ tenantId: 'tenant-abc', userId: 'user-1', papel: 'admin' });
  });

  it('rejeita requisição sem Authorization header', async () => {
    const res = await request(app).get('/protegido');
    expect(res.status).toBe(401);
  });

  it('rejeita token inválido/adulterado', async () => {
    const res = await request(app).get('/protegido').set('Authorization', 'Bearer token-invalido');
    expect(res.status).toBe(401);
  });

  it('requireRole nega papel sem permissão', async () => {
    const token = signAccessToken({ sub: 'user-2', tenantId: 'tenant-abc', papel: 'operador' });
    const res = await request(app).get('/somente-admin').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('requireRole permite o papel correto', async () => {
    const token = signAccessToken({ sub: 'user-3', tenantId: 'tenant-abc', papel: 'admin' });
    const res = await request(app).get('/somente-admin').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
