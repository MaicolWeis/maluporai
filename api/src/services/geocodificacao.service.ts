import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

/**
 * Coordenadas de cidades para o mapa da visão geral.
 *
 * Só "cidade, estado, país" sai para o serviço externo (OpenStreetMap /
 * Nominatim) — nunca nome, telefone ou qualquer dado de pessoa. O resultado
 * fica em cache permanente (tabela geocache, compartilhada entre empresas),
 * então cada cidade é consultada uma vez só.
 *
 * Política de uso do Nominatim: no máximo 1 requisição por segundo,
 * User-Agent identificável e cache dos resultados — a fila abaixo garante isso.
 */

export interface Lugar {
  cidade: string;
  estado?: string | null;
  pais: string; // ISO-2
}

export interface Coordenada {
  lat: number;
  lng: number;
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function chaveDoLugar(l: Lugar) {
  return [normalizar(l.cidade), normalizar(l.estado ?? ''), l.pais.toUpperCase()].join('|');
}

const driver = env.GEOCODER ?? (env.NODE_ENV === 'test' ? 'memoria' : 'nominatim');

/** Coordenada fictícia mas estável (testes): espalha pela América do Sul. */
function coordenadaDeTeste(chave: string): Coordenada {
  let h = 0;
  for (const c of chave) h = (h * 31 + c.charCodeAt(0)) | 0;
  return { lat: -30 + (Math.abs(h) % 2500) / 100, lng: -70 + (Math.abs(h >> 8) % 3000) / 100 };
}

async function buscarNominatim(l: Lugar): Promise<Coordenada | null> {
  const params = new URLSearchParams({
    city: l.cidade,
    countrycodes: l.pais.toLowerCase(),
    format: 'jsonv2',
    limit: '1',
    'accept-language': 'pt-BR',
  });
  if (l.estado) params.set('state', l.pais === 'BR' ? ESTADOS_BR[l.estado.toUpperCase()] ?? l.estado : l.estado);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': `maluporai/1.0 (${env.FRONTEND_URL})` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const dados = (await res.json()) as { lat: string; lon: string }[];
  if (dados.length === 0) {
    // Cidade pequena às vezes não é "city": tenta busca livre.
    const livre = new URLSearchParams({
      q: [l.cidade, l.estado && (l.pais === 'BR' ? ESTADOS_BR[l.estado.toUpperCase()] ?? l.estado : l.estado)]
        .filter(Boolean)
        .join(', '),
      countrycodes: l.pais.toLowerCase(),
      format: 'jsonv2',
      limit: '1',
    });
    await esperar(1100);
    const r2 = await fetch(`https://nominatim.openstreetmap.org/search?${livre}`, {
      headers: { 'User-Agent': `maluporai/1.0 (${env.FRONTEND_URL})` },
      signal: AbortSignal.timeout(8000),
    });
    if (!r2.ok) throw new Error(`nominatim ${r2.status}`);
    const d2 = (await r2.json()) as { lat: string; lon: string }[];
    return d2[0] ? { lat: Number(d2[0].lat), lng: Number(d2[0].lon) } : null;
  }
  return { lat: Number(dados[0].lat), lng: Number(dados[0].lon) };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Fila única no processo: uma consulta externa por vez, com 1,1 s entre elas.
const pendentes = new Map<string, Lugar>();
let processando = false;

async function processarFila() {
  if (processando) return;
  processando = true;
  try {
    while (pendentes.size > 0) {
      const [chave, lugar] = pendentes.entries().next().value as [string, Lugar];
      pendentes.delete(chave);
      try {
        const jaTem = await prisma.geocache.findUnique({ where: { chave } });
        if (jaTem) continue;
        const coord = driver === 'memoria' ? coordenadaDeTeste(chave) : await buscarNominatim(lugar);
        await prisma.geocache.upsert({
          where: { chave },
          create: { chave, lat: coord?.lat ?? null, lng: coord?.lng ?? null, encontrado: !!coord },
          update: {},
        });
      } catch (err) {
        // Falha de rede/limite: não grava, tenta de novo numa próxima vez.
        logger.warn({ err: (err as Error).message, chave }, '[geocodificacao] falha ao buscar coordenadas');
      }
      if (driver === 'nominatim') await esperar(1100);
    }
  } finally {
    processando = false;
  }
}

/** Agenda a busca das coordenadas (não bloqueia). */
export function agendar(lugares: Lugar[]) {
  if (driver === 'desligado') return;
  for (const l of lugares) {
    if (!l.cidade?.trim() || !/^[A-Z]{2}$/i.test(l.pais)) continue;
    pendentes.set(chaveDoLugar(l), l);
  }
  processarFila().catch((err) => logger.warn({ err: (err as Error).message }, '[geocodificacao] fila interrompida'));
}

/** Coordenadas já conhecidas (só cache). Chaves sem cache voltam em `faltando`. */
export async function coordenadasConhecidas(lugares: Lugar[]) {
  const chaves = [...new Set(lugares.map(chaveDoLugar))];
  const linhas = chaves.length ? await prisma.geocache.findMany({ where: { chave: { in: chaves } } }) : [];
  const porChave = new Map(linhas.map((l) => [l.chave, l]));
  const faltando = lugares.filter((l) => !porChave.has(chaveDoLugar(l)));
  return { porChave, faltando };
}

/** Só para os testes: espera a fila esvaziar. */
export async function aguardarFila() {
  for (let i = 0; i < 200 && (processando || pendentes.size > 0); i++) await esperar(20);
}

const ESTADOS_BR: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};
