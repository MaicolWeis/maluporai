import { useEffect, useState } from 'react';
import { formatDestino } from '../lib/paises';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { NovaViagemModal } from '../components/NovaViagemModal';
import { Pill } from '../components/Pill';
import { Select } from '../components/Select';
import { ViagemDrawer } from '../components/ViagemDrawer';
import { api } from '../lib/api';
import { formatBRL, formatDataCivil } from '../lib/format';
import { STATUS_LABEL, STATUS_PILL } from '../lib/viagemStatus';
import type { ViagemListItem, ViagemStatus } from '../types/viagem';


const formatMoeda = formatBRL;

type FiltroStatus = 'ativas' | 'todas' | ViagemStatus;
interface Filtros {
  status: FiltroStatus;
  de: string;
  ate: string;
}
const FILTROS_PADRAO: Filtros = { status: 'ativas', de: '', ate: '' };

function formatPeriodo(dataInicio: string, dataFim: string) {
  return `${formatDataCivil(dataInicio)} — ${formatDataCivil(dataFim)}`;
}

export function Viagens() {
  const [viagens, setViagens] = useState<ViagemListItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [viagemSelecionadaId, setViagemSelecionadaId] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_PADRAO);

  const carregar = async (f: Filtros = filtros) => {
    setCarregando(true);
    try {
      const params: Record<string, string> = { porPagina: '100' };
      if (f.status === 'todas') params.incluirArquivadas = 'true';
      else if (f.status !== 'ativas') params.status = f.status;
      if (f.de) params.dataInicio = f.de;
      if (f.ate) params.dataFim = f.ate;
      const { data } = await api.get('/viagens', { params });
      setViagens(data.viagens);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar(filtros);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  const filtrosAtivos = filtros.status !== 'ativas' || !!filtros.de || !!filtros.ate;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Viagens</h1>
          <p className="text-xs text-slate-500">Planejamento, inscrições e financeiro de cada viagem</p>
        </div>
        <Button onClick={() => setModalAberto(true)}>Nova viagem</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-card p-3 mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-48">
          <Select
            label="Status"
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value as FiltroStatus })}
          >
            <option value="ativas">Ativas (sem arquivadas)</option>
            <option value="todas">Todas, inclusive arquivadas</option>
            {(Object.keys(STATUS_LABEL) as ViagemStatus[]).map((st) => (
              <option key={st} value={st}>
                {STATUS_LABEL[st]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1 min-w-[140px] sm:flex-none sm:w-40">
          <Input label="Viagem de" type="date" value={filtros.de} onChange={(e) => setFiltros({ ...filtros, de: e.target.value })} />
        </div>
        <div className="flex-1 min-w-[140px] sm:flex-none sm:w-40">
          <Input
            label="até"
            type="date"
            value={filtros.ate}
            min={filtros.de || undefined}
            onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })}
          />
        </div>
        {filtrosAtivos && (
          <Button variant="ghost" onClick={() => setFiltros(FILTROS_PADRAO)}>
            Limpar filtros
          </Button>
        )}
        <span className="ml-auto self-center text-xs text-slate-500">
          {carregando ? '…' : `${viagens.length} viage${viagens.length === 1 ? 'm' : 'ns'}`}
        </span>
      </div>

      {carregando ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : viagens.length === 0 ? (
        filtrosAtivos ? (
          <EmptyState titulo="Nenhuma viagem encontrada" descricao="Ajuste ou limpe os filtros acima." />
        ) : (
          <EmptyState titulo="Nenhuma viagem ainda" descricao="Cadastre a primeira viagem pra começar a organizar." />
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {viagens.map((v) => {
            const ocupacaoPct = Math.min(100, Math.round((v.pessoasConfirmadas / v.capacidade) * 100));
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setViagemSelecionadaId(v.id)}
                className="text-left bg-white rounded-xl border border-stone-200 shadow-card overflow-hidden hover:border-brand transition-colors"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-zinc-900">{v.nome}</p>
                    <Pill cls={STATUS_PILL[v.status]}>{STATUS_LABEL[v.status]}</Pill>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {formatDestino(v)}
                  </p>
                  <p className="text-xs text-zinc-500 mb-3">{formatPeriodo(v.dataInicio, v.dataFim)}</p>

                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                      <span>Ocupação</span>
                      <span>
                        {v.pessoasConfirmadas} / {v.capacidade}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden">
                      <div className="h-full bg-brand" style={{ width: `${ocupacaoPct}%` }} />
                    </div>
                  </div>

                  <div className="flex gap-4 text-xs">
                    <span className="text-emerald-700 font-semibold">{formatMoeda(v.totalRecebido)}</span>
                    <span className="text-red-700 font-semibold">{formatMoeda(v.totalDespesas)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <NovaViagemModal aberto={modalAberto} onFechar={() => setModalAberto(false)} onCriada={() => carregar()} />

      <ViagemDrawer
        viagemId={viagemSelecionadaId}
        onFechar={() => setViagemSelecionadaId(null)}
        onAtualizado={() => carregar()}
      />
    </div>
  );
}
