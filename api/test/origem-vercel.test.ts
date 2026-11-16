import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { origemVercel } from '../src/middlewares/origemVercel.js';

const SEGREDO = 'a'.repeat(64);

function appDeTeste() {
  const app = express();
  app.use(origemVercel);
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/ip', (req, res) => res.json({ ip: req.ip }));
  return app;
}

afterEach(() => {
  (env as { ORIGIN_SECRET?: string }).ORIGIN_SECRET = undefined;
});

describe('origemVercel', () => {
  it('sem ORIGIN_SECRET configurado não interfere', async () => {
    const res = await request(appDeTeste()).get('/ip').set('x-real-ip', '200.1.2.3');
    expect(res.status).toBe(200);
    expect(res.body.ip).not.toBe('200.1.2.3'); // cabeçalho de IP não é confiado
  });

  it('com segredo: recusa acesso direto, libera /health e usa o IP do visitante informado pela Vercel', async () => {
    (env as { ORIGIN_SECRET?: string }).ORIGIN_SECRET = SEGREDO;
    const app = appDeTeste();

    const direto = await request(app).get('/ip').set('x-real-ip', '200.1.2.3');
    expect(direto.status).toBe(403);

    const errado = await request(app).get('/ip').set('x-origin-secret', 'b'.repeat(64));
    expect(errado.status).toBe(403);

    expect((await request(app).get('/health')).status).toBe(200);

    const viaVercel = await request(app)
      .get('/ip')
      .set('x-origin-secret', SEGREDO)
      .set('x-vercel-forwarded-for', '200.1.2.3')
      .set('x-forwarded-for', '200.1.2.3, 76.76.21.21');
    expect(viaVercel.status).toBe(200);
    expect(viaVercel.body.ip).toBe('200.1.2.3');
  });
});
