import { env } from '../config/env.js';
import { AppError } from './errors.js';
import { logger } from './logger.js';

/**
 * Storage de arquivos (P8.5). Só o Storage do Supabase é usado — o banco
 * continua no Postgres da aplicação. A service key fica apenas no servidor;
 * o front nunca fala direto com o Storage, só recebe URLs assinadas.
 *
 * Mesmo padrão do EmailService: driver real (Supabase) quando configurado,
 * driver em memória em dev/test, e "indisponível" em produção sem config.
 */
export const BUCKETS = ['comprovantes', 'logos'] as const;
export type Bucket = (typeof BUCKETS)[number];

export interface StorageDriver {
  upload(bucket: Bucket, path: string, conteudo: Buffer, contentType: string): Promise<void>;
  signedUrl(bucket: Bucket, path: string, expiraEmSegundos: number): Promise<string>;
  remove(bucket: Bucket, path: string): Promise<void>;
}

class SupabaseStorageDriver implements StorageDriver {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceKey: string,
  ) {}

  private headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...extra };
  }

  async upload(bucket: Bucket, path: string, conteudo: Buffer, contentType: string) {
    const res = await fetch(`${this.baseUrl}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': contentType, 'x-upsert': 'false' }),
      body: new Uint8Array(conteudo),
    });
    if (!res.ok) {
      logger.error({ status: res.status, bucket }, 'Falha no upload ao Supabase Storage');
      throw new AppError(502, 'STORAGE_FALHOU', 'Não foi possível enviar o arquivo. Tente novamente.');
    }
  }

  async signedUrl(bucket: Bucket, path: string, expiraEmSegundos: number) {
    const res = await fetch(`${this.baseUrl}/storage/v1/object/sign/${bucket}/${path}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: expiraEmSegundos }),
    });
    if (!res.ok) {
      logger.error({ status: res.status, bucket }, 'Falha ao assinar URL no Supabase Storage');
      throw new AppError(502, 'STORAGE_FALHOU', 'Não foi possível abrir o arquivo.');
    }
    const { signedURL } = (await res.json()) as { signedURL: string };
    return `${this.baseUrl}/storage/v1${signedURL}`;
  }

  async remove(bucket: Bucket, path: string) {
    const res = await fetch(`${this.baseUrl}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: [path] }),
    });
    if (!res.ok) logger.warn({ status: res.status, bucket }, 'Falha ao remover arquivo do Supabase Storage');
  }
}

/** Dev/test: guarda em memória. `arquivos` é exposto pros testes conferirem. */
export class MemoryStorageDriver implements StorageDriver {
  readonly arquivos = new Map<string, { conteudo: Buffer; contentType: string }>();

  async upload(bucket: Bucket, path: string, conteudo: Buffer, contentType: string) {
    this.arquivos.set(`${bucket}/${path}`, { conteudo, contentType });
  }
  async signedUrl(bucket: Bucket, path: string, expiraEmSegundos: number) {
    return `memory://${bucket}/${path}?expires=${expiraEmSegundos}`;
  }
  async remove(bucket: Bucket, path: string) {
    this.arquivos.delete(`${bucket}/${path}`);
  }
}

class StorageIndisponivel implements StorageDriver {
  private erro() {
    return new AppError(
      503,
      'STORAGE_NAO_CONFIGURADO',
      'Envio de arquivos ainda não está disponível neste ambiente.',
    );
  }
  async upload(): Promise<void> {
    throw this.erro();
  }
  async signedUrl(): Promise<string> {
    throw this.erro();
  }
  async remove() {}
}

function criarDriver(): StorageDriver {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
    return new SupabaseStorageDriver(env.SUPABASE_URL.replace(/\/$/, ''), env.SUPABASE_SERVICE_KEY);
  }
  if (env.NODE_ENV === 'production') {
    logger.warn('SUPABASE_URL/SUPABASE_SERVICE_KEY ausentes: uploads desabilitados.');
    return new StorageIndisponivel();
  }
  return new MemoryStorageDriver();
}

export const storage: StorageDriver = criarDriver();

/**
 * Referência guardada no banco: "<bucket>/<tenant_id>/<entidade>/<uuid>.<ext>".
 * O prefixo do tenant é a fronteira de isolamento: só assinamos URL de
 * referência cujo segundo segmento é o tenant do JWT.
 */
export function montarReferencia(bucket: Bucket, tenantId: string, entidade: string, nome: string) {
  return `${bucket}/${tenantId}/${entidade}/${nome}`;
}

export function interpretarReferencia(referencia: string): { bucket: Bucket; path: string; tenantId: string } | null {
  if (referencia.includes('..') || referencia.includes('//') || referencia.startsWith('/')) return null;
  const [bucket, tenantId, ...resto] = referencia.split('/');
  if (!(BUCKETS as readonly string[]).includes(bucket) || !tenantId || resto.length === 0) return null;
  return { bucket: bucket as Bucket, tenantId, path: [tenantId, ...resto].join('/') };
}
