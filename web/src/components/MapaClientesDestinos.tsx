import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { formatDataCivil } from '../lib/format';
import { bandeira, nomePais } from '../lib/paises';
import { STATUS_LABEL } from '../lib/viagemStatus';
import type { ViagemStatus } from '../types/viagem';

interface Posicao {
  lat: number;
  lng: number;
}

interface DadosMapa {
  clientes: { cidade: string; uf: string | null; total: number; posicao: Posicao | null }[];
  destinos: {
    viagemId: string;
    nome: string;
    cidade: string;
    estado: string | null;
    pais: string;
    dataInicio: string;
    dataFim: string;
    status: ViagemStatus;
    posicao: Posicao | null;
  }[];
  clientesSemCidade: number;
  pendentes: number;
  naoLocalizadas: string[];
}

const AZUL = '#1C69D4';
const LARANJA = '#D97706';

function iconeClientes(total: number) {
  const d = Math.round(Math.min(46, 22 + Math.sqrt(total) * 5));
  return L.divIcon({
    className: '',
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
    html: `<div style="width:${d}px;height:${d}px;border-radius:9999px;background:${AZUL}CC;border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.35);color:#fff;font:600 ${total > 99 ? 10 : 12}px Inter,sans-serif;display:flex;align-items:center;justify-content:center">${total}</div>`,
  });
}

function iconeDestino(qtd: number) {
  const badge =
    qtd > 1
      ? `<span style="position:absolute;top:-4px;right:-6px;min-width:16px;height:16px;padding:0 3px;border-radius:9999px;background:#0F172A;color:#fff;font:600 10px Inter,sans-serif;display:flex;align-items:center;justify-content:center">${qtd}</span>`
      : '';
  return L.divIcon({
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -30],
    html: `<div style="position:relative;width:28px;height:36px;filter:drop-shadow(0 1px 2px rgba(15,23,42,.4))">
      <svg width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.2 0 13.9 0 24.3 14 36 14 36s14-11.7 14-22.1C28 6.2 21.7 0 14 0z" fill="${LARANJA}" stroke="#fff" stroke-width="2"/>
      <path d="M8.5 17.5l11-5-5 11-1.2-4.8z" fill="#fff"/></svg>${badge}</div>`,
  });
}

function textoLugar(cidade: string, estado: string | null, pais: string) {
  if (pais === 'BR') return `${cidade}${estado ? `/${estado}` : ''}`;
  return `${bandeira(pais)} ${cidade}${estado ? `, ${estado}` : ''} · ${nomePais(pais)}`;
}

/** Mapa da visão geral: clientes por cidade (círculos azuis) e destinos das viagens (pinos laranja). */
export function MapaClientesDestinos({ onAbrirViagem }: { onAbrirViagem: (viagemId: string) => void }) {
  const elemento = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const camadaClientes = useRef<L.LayerGroup | null>(null);
  const camadaDestinos = useRef<L.LayerGroup | null>(null);
  const [dados, setDados] = useState<DadosMapa | null>(null);
  const [erro, setErro] = useState('');
  const [verClientes, setVerClientes] = useState(true);
  const [verDestinos, setVerDestinos] = useState(true);
  const abrirViagem = useRef(onAbrirViagem);
  abrirViagem.current = onAbrirViagem;

  // Carrega; enquanto houver cidades sendo localizadas, recarrega algumas vezes.
  useEffect(() => {
    let ativo = true;
    let tentativas = 0;
    let timer: ReturnType<typeof setTimeout>;
    const carregar = async () => {
      try {
        const { data } = await api.get<DadosMapa>('/mapa');
        if (!ativo) return;
        setDados(data);
        if (data.pendentes > 0 && tentativas++ < 8) timer = setTimeout(carregar, 4000);
      } catch {
        if (ativo) setErro('Não foi possível carregar o mapa.');
      }
    };
    carregar();
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, []);

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!elemento.current || mapa.current) return;
    const m = L.map(elemento.current, { scrollWheelZoom: false, worldCopyJump: true }).setView([-15, -60], 3);
    // Mapas do OpenStreetMap (sem chave). Tons suavizados via CSS (.mapa-suave)
    // para os marcadores se destacarem.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(m);
    // Rolagem do mouse só depois de clicar no mapa (não sequestra a rolagem da página).
    m.on('click', () => m.scrollWheelZoom.enable());
    m.on('mouseout', () => m.scrollWheelZoom.disable());
    camadaClientes.current = L.layerGroup().addTo(m);
    camadaDestinos.current = L.layerGroup().addTo(m);
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
    };
  }, []);

  // Desenha os marcadores quando os dados chegam.
  const enquadrado = useRef(false);
  useEffect(() => {
    const m = mapa.current;
    if (!m || !dados || !camadaClientes.current || !camadaDestinos.current) return;
    camadaClientes.current.clearLayers();
    camadaDestinos.current.clearLayers();
    const pontos: L.LatLngExpression[] = [];

    for (const c of dados.clientes) {
      if (!c.posicao) continue;
      pontos.push([c.posicao.lat, c.posicao.lng]);
      L.marker([c.posicao.lat, c.posicao.lng], { icon: iconeClientes(c.total), zIndexOffset: 0 })
        .bindTooltip(`${textoLugar(c.cidade, c.uf, 'BR')} — ${c.total} cliente${c.total > 1 ? 's' : ''}`, {
          direction: 'top',
        })
        .addTo(camadaClientes.current);
    }

    // Viagens no mesmo destino viram um pino só, com a lista no popup.
    const porLugar = new Map<string, DadosMapa['destinos']>();
    for (const d of dados.destinos) {
      if (!d.posicao) continue;
      const k = `${d.posicao.lat.toFixed(4)},${d.posicao.lng.toFixed(4)}`;
      porLugar.set(k, [...(porLugar.get(k) ?? []), d]);
    }
    for (const grupo of porLugar.values()) {
      const { posicao, cidade, estado, pais } = grupo[0];
      if (!posicao) continue;
      pontos.push([posicao.lat, posicao.lng]);
      const conteudo = document.createElement('div');
      conteudo.style.font = '13px Inter, sans-serif';
      const titulo = document.createElement('p');
      titulo.style.cssText = 'font-weight:600;margin:0 0 6px';
      titulo.textContent = textoLugar(cidade, estado, pais);
      conteudo.appendChild(titulo);
      for (const v of grupo) {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.style.cssText =
          'display:block;width:100%;text-align:left;padding:4px 0;border:0;background:none;cursor:pointer;color:#0F3F80';
        botao.innerHTML = `<strong></strong><br><span style="color:#64748B;font-size:11px"></span>`;
        (botao.querySelector('strong') as HTMLElement).textContent = v.nome;
        (botao.querySelector('span') as HTMLElement).textContent =
          `${formatDataCivil(v.dataInicio)} — ${formatDataCivil(v.dataFim)} · ${STATUS_LABEL[v.status]}`;
        botao.onclick = () => abrirViagem.current(v.viagemId);
        conteudo.appendChild(botao);
      }
      L.marker([posicao.lat, posicao.lng], { icon: iconeDestino(grupo.length), zIndexOffset: 1000 })
        .bindTooltip(grupo.length > 1 ? `${grupo.length} viagens — ${cidade}` : grupo[0].nome, { direction: 'top', offset: [0, -30] })
        .bindPopup(conteudo, { minWidth: 200 })
        .addTo(camadaDestinos.current);
    }

    if (!enquadrado.current && pontos.length > 0) {
      m.fitBounds(L.latLngBounds(pontos), { padding: [40, 40], maxZoom: 7 });
      enquadrado.current = dados.pendentes === 0;
    }
  }, [dados]);

  useEffect(() => {
    const m = mapa.current;
    if (!m || !camadaClientes.current || !camadaDestinos.current) return;
    if (verClientes) camadaClientes.current.addTo(m);
    else camadaClientes.current.remove();
    if (verDestinos) camadaDestinos.current.addTo(m);
    else camadaDestinos.current.remove();
  }, [verClientes, verDestinos]);

  const totalClientes = dados?.clientes.reduce((s, c) => s + c.total, 0) ?? 0;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mapa de clientes e destinos</h2>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={verClientes} onChange={(e) => setVerClientes(e.target.checked)} />
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: AZUL }} />
            Clientes por cidade
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={verDestinos} onChange={(e) => setVerDestinos(e.target.checked)} />
            <span className="inline-block h-3 w-2.5 rounded-t-full" style={{ background: LARANJA }} />
            Destinos das viagens
          </label>
        </div>
      </div>
      <div className="mapa-suave isolate relative rounded-xl border border-slate-200 shadow-card overflow-hidden bg-slate-100">
        <div ref={elemento} className="h-[320px] md:h-[420px]" aria-label="Mapa de clientes e destinos" />
        {!dados && !erro && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">Carregando mapa…</p>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        {erro && <span className="text-red-600">{erro}</span>}
        {dados && (
          <span>
            {totalClientes} cliente{totalClientes === 1 ? '' : 's'} em {dados.clientes.length} cidade
            {dados.clientes.length === 1 ? '' : 's'} · {dados.destinos.length} viage
            {dados.destinos.length === 1 ? 'm' : 'ns'} ativa{dados.destinos.length === 1 ? '' : 's'}
          </span>
        )}
        {dados && dados.clientesSemCidade > 0 && (
          <span>{dados.clientesSemCidade} sem cidade no cadastro</span>
        )}
        {dados && dados.pendentes > 0 && <span>Localizando {dados.pendentes} cidade(s)…</span>}
        {dados && dados.naoLocalizadas.length > 0 && (
          <span className="text-amber-700">Não localizadas (confira a grafia): {dados.naoLocalizadas.join(', ')}</span>
        )}
      </div>
    </section>
  );
}
