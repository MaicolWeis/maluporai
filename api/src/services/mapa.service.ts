import { prisma } from '../lib/prisma.js';
import { agendar, chaveDoLugar, coordenadasConhecidas, type Lugar } from './geocodificacao.service.js';

/**
 * Dados do mapa da visão geral: clientes agrupados por cidade (só a contagem,
 * sem nomes) e destinos das viagens ativas. Cidades ainda sem coordenadas
 * entram na fila de geocodificação e aparecem nas próximas consultas.
 */
export async function dadosDoMapa() {
  const [gruposClientes, semCidade, viagens] = await Promise.all([
    prisma.cliente.groupBy({
      by: ['cidade', 'uf', 'pais'],
      where: { anonimizadoEm: null, cidade: { not: null } },
      _count: { _all: true },
    }),
    prisma.cliente.count({ where: { anonimizadoEm: null, OR: [{ cidade: null }, { cidade: '' }] } }),
    prisma.viagem.findMany({
      where: { status: { notIn: ['cancelada', 'arquivada'] } },
      select: {
        id: true,
        nome: true,
        destinoCidade: true,
        destinoUf: true,
        destinoPais: true,
        dataInicio: true,
        dataFim: true,
        status: true,
      },
      orderBy: { dataInicio: 'asc' },
    }),
  ]);

  // Agrupa de novo pela chave normalizada ("Blumenau" e "blumenau " são a mesma cidade).
  const cidades = new Map<string, { lugar: Lugar; total: number }>();
  for (const g of gruposClientes) {
    if (!g.cidade?.trim()) continue;
    const lugar: Lugar = { cidade: g.cidade.trim(), estado: g.uf, pais: g.pais };
    const chave = chaveDoLugar(lugar);
    const atual = cidades.get(chave);
    if (atual) atual.total += g._count._all;
    else cidades.set(chave, { lugar, total: g._count._all });
  }

  const lugaresViagens: Lugar[] = viagens.map((v) => ({ cidade: v.destinoCidade, estado: v.destinoUf, pais: v.destinoPais }));
  const todos = [...[...cidades.values()].map((c) => c.lugar), ...lugaresViagens];
  const { porChave, faltando } = await coordenadasConhecidas(todos);
  agendar(faltando);

  const coord = (l: Lugar) => {
    const c = porChave.get(chaveDoLugar(l));
    return c?.encontrado && c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null;
  };

  const clientes = [...cidades.values()].map(({ lugar, total }) => ({
    cidade: lugar.cidade,
    uf: lugar.estado ?? null,
    pais: lugar.pais,
    total,
    posicao: coord(lugar),
  }));

  const destinos = viagens.map((v, i) => ({
    viagemId: v.id,
    nome: v.nome,
    cidade: v.destinoCidade,
    estado: v.destinoUf,
    pais: v.destinoPais,
    dataInicio: v.dataInicio,
    dataFim: v.dataFim,
    status: v.status,
    posicao: coord(lugaresViagens[i]),
  }));

  return {
    clientes,
    destinos,
    clientesSemCidade: semCidade,
    // Ainda buscando coordenadas (o app recarrega o mapa em alguns segundos).
    pendentes: faltando.length,
    // Cidades que o serviço de mapas não encontrou (conferir a grafia).
    naoLocalizadas: [
      ...clientes.filter((c) => !c.posicao).map((c) => ({ cidade: c.cidade, uf: c.uf, pais: c.pais })),
      ...destinos.filter((d) => !d.posicao).map((d) => ({ cidade: d.cidade, uf: d.estado, pais: d.pais })),
    ]
      .filter((l) => porChave.has(chaveDoLugar({ cidade: l.cidade, estado: l.uf, pais: l.pais })))
      .map((l) => `${l.cidade}${l.uf ? `/${l.uf}` : ''}${l.pais !== 'BR' ? ` (${l.pais})` : ''}`),
  };
}
