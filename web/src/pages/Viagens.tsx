import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { NovaViagemModal } from '../components/NovaViagemModal';
import { Pill } from '../components/Pill';
import { RoadStrip } from '../components/RoadStrip';
import { ViagemDrawer } from '../components/ViagemDrawer';
import { api } from '../lib/api';
import type { ViagemListItem, ViagemStatus } from '../types/viagem';

const STATUS_LABEL: Record<ViagemStatus, string> = {
  planejamento: 'Planejamento',
  inscricoes: 'Inscrições abertas',
  confirmada: 'Confirmada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const STATUS_PILL: Record<ViagemStatus, string> = {
  planejamento: 'bg-stone-100 text-zinc-600 border border-stone-200',
  inscricoes: 'bg-amber-100 text-amber-700 border border-amber-200',
  confirmada: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  concluida: 'bg-zinc-900 text-amber-400',
  cancelada: 'bg-red-100 text-red-700 border border-red-200',
};

function formatMoeda(valor: string) {
  return `R$ ${Number(valor).toFixed(2)}`;
}

function formatPeriodo(dataInicio: string, dataFim: string) {
  const inicio = new Date(dataInicio).toLocaleDateString('pt-BR');
  const fim = new Date(dataFim).toLocaleDateString('pt-BR');
  return `${inicio} — ${fim}`;
}

export function Viagens() {
  const [viagens, setViagens] = useState<ViagemListItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [viagemSelecionadaId, setViagemSelecionadaId] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/viagens');
      setViagens(data.viagens);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">Viagens</h1>
        <Button onClick={() => setModalAberto(true)}>Nova viagem</Button>
      </div>

      {carregando ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : viagens.length === 0 ? (
        <EmptyState titulo="Nenhuma viagem ainda" descricao="Cadastre a primeira viagem pra começar a organizar." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {viagens.map((v) => {
            const ocupacaoPct = Math.min(100, Math.round((v.pessoasConfirmadas / v.capacidade) * 100));
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setViagemSelecionadaId(v.id)}
                className="text-left bg-white rounded-xl border border-stone-200 overflow-hidden hover:border-amber-400 transition-colors"
              >
                <RoadStrip />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-black text-zinc-900">{v.nome}</p>
                    <Pill cls={STATUS_PILL[v.status]}>{STATUS_LABEL[v.status]}</Pill>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {v.destinoCidade}/{v.destinoUf}
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
                      <div className="h-full bg-amber-400" style={{ width: `${ocupacaoPct}%` }} />
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

      <NovaViagemModal aberto={modalAberto} onFechar={() => setModalAberto(false)} onCriada={carregar} />

      <ViagemDrawer
        viagemId={viagemSelecionadaId}
        onFechar={() => setViagemSelecionadaId(null)}
        onAtualizado={carregar}
      />
    </div>
  );
}
