import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Atracao, AtracaoTipo, Hotel, Incluso, ViagemDetalhe, ViagemStatus } from '../types/viagem';
import { Button } from './Button';
import { Drawer } from './Drawer';
import { EmptyState } from './EmptyState';
import { Input } from './Input';
import { Pill } from './Pill';
import { Select } from './Select';

type Aba = 'resumo' | 'clientes' | 'despesas' | 'financeiro';

const ABAS: { id: Aba; label: string }[] = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'despesas', label: 'Despesas' },
  { id: 'financeiro', label: 'Financeiro' },
];

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

const TRANSICOES_VALIDAS: Record<ViagemStatus, ViagemStatus[]> = {
  planejamento: ['inscricoes', 'cancelada'],
  inscricoes: ['confirmada', 'cancelada'],
  confirmada: ['concluida', 'cancelada'],
  concluida: [],
  cancelada: [],
};

function formatMoeda(valor: string | null) {
  return valor == null ? '—' : `R$ ${Number(valor).toFixed(2)}`;
}

function formatData(valor: string | null) {
  return valor ? new Date(valor).toLocaleDateString('pt-BR') : '—';
}

interface Props {
  viagemId: string | null;
  onFechar: () => void;
  onAtualizado: () => void;
}

export function ViagemDrawer({ viagemId, onFechar, onAtualizado }: Props) {
  const [aba, setAba] = useState<Aba>('resumo');
  const [viagem, setViagem] = useState<ViagemDetalhe | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mudandoStatus, setMudandoStatus] = useState(false);
  const [erroStatus, setErroStatus] = useState('');

  const carregar = async (id: string) => {
    setCarregando(true);
    try {
      const { data } = await api.get(`/viagens/${id}`);
      setViagem(data.viagem);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!viagemId) {
      setViagem(null);
      return;
    }
    setAba('resumo');
    setErroStatus('');
    carregar(viagemId);
  }, [viagemId]);

  const recarregar = async () => {
    if (!viagemId) return;
    await carregar(viagemId);
    onAtualizado();
  };

  const mudarStatus = async (novoStatus: ViagemStatus) => {
    if (!viagemId || !novoStatus) return;
    setErroStatus('');

    if (novoStatus === 'cancelada') {
      if (!window.confirm('Cancelar esta viagem?')) return;
    }

    setMudandoStatus(true);
    try {
      await api.patch(`/viagens/${viagemId}/status`, { status: novoStatus });
      await recarregar();
    } catch (err: any) {
      if (err.response?.data?.error?.code === 'MOTIVO_OBRIGATORIO') {
        const motivo = window.prompt('Essa viagem tem inscrições — informe o motivo do cancelamento:');
        if (!motivo) {
          setMudandoStatus(false);
          return;
        }
        try {
          await api.patch(`/viagens/${viagemId}/status`, { status: novoStatus, motivo });
          await recarregar();
        } catch (err2: any) {
          setErroStatus(err2.response?.data?.error?.message ?? 'Não foi possível mudar o status.');
        }
      } else {
        setErroStatus(err.response?.data?.error?.message ?? 'Não foi possível mudar o status.');
      }
    } finally {
      setMudandoStatus(false);
    }
  };

  const transicoes = viagem ? TRANSICOES_VALIDAS[viagem.status] : [];

  return (
    <Drawer
      titulo={viagem?.nome ?? 'Viagem'}
      aberto={!!viagemId}
      onFechar={onFechar}
      acessorio={
        viagem && (
          <div className="flex items-center gap-2">
            <Pill cls={STATUS_PILL[viagem.status]}>{STATUS_LABEL[viagem.status]}</Pill>
            {transicoes.length > 0 && (
              <select
                value=""
                disabled={mudandoStatus}
                onChange={(e) => mudarStatus(e.target.value as ViagemStatus)}
                className="text-xs border border-stone-300 rounded-lg px-2 py-1 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
              >
                <option value="" disabled>
                  Mudar status
                </option>
                {transicoes.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            )}
          </div>
        )
      }
    >
      {carregando || !viagem ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : (
        <div>
          {erroStatus && <p className="text-red-600 text-xs mb-4">{erroStatus}</p>}

          <div className="flex gap-1 border-b border-stone-200 mb-6">
            {ABAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  aba === a.id ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          {aba === 'resumo' && <AbaResumo viagem={viagem} onAtualizado={recarregar} />}
          {aba === 'clientes' && (
            <EmptyState titulo="Clientes da viagem" descricao="As inscrições chegam no P7." />
          )}
          {aba === 'despesas' && <EmptyState titulo="Despesas" descricao="O controle de despesas chega no P9." />}
          {aba === 'financeiro' && (
            <EmptyState titulo="Financeiro" descricao="O dashboard financeiro chega no P10." />
          )}
        </div>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Aba Resumo
// ---------------------------------------------------------------------------

function AbaResumo({ viagem, onAtualizado }: { viagem: ViagemDetalhe; onAtualizado: () => void }) {
  return (
    <div className="space-y-8">
      <DadosBasicos viagem={viagem} onSalvo={onAtualizado} />
      <Hospedagem viagemId={viagem.id} hoteis={viagem.hoteis} onAtualizado={onAtualizado} />
      <AtracaoSecao viagemId={viagem.id} atracoes={viagem.atracoes} onAtualizado={onAtualizado} />
      <InclusosSecao viagemId={viagem.id} inclusos={viagem.inclusos} onAtualizado={onAtualizado} />
    </div>
  );
}

function DadosBasicos({ viagem, onSalvo }: { viagem: ViagemDetalhe; onSalvo: () => void }) {
  const [form, setForm] = useState({
    nome: viagem.nome,
    destinoCidade: viagem.destinoCidade,
    destinoUf: viagem.destinoUf,
    dataInicio: viagem.dataInicio.slice(0, 10),
    dataFim: viagem.dataFim.slice(0, 10),
    capacidade: String(viagem.capacidade),
    precoTitular: viagem.precoTitular,
    precoAcompanhante: viagem.precoAcompanhante ?? '',
    descricao: viagem.descricao ?? '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setSalvando(true);
    try {
      await api.patch(`/viagens/${viagem.id}`, {
        nome: form.nome,
        destinoCidade: form.destinoCidade,
        destinoUf: form.destinoUf,
        dataInicio: form.dataInicio,
        dataFim: form.dataFim,
        capacidade: Number(form.capacidade),
        precoTitular: Number(form.precoTitular),
        precoAcompanhante: form.precoAcompanhante ? Number(form.precoAcompanhante) : undefined,
        descricao: form.descricao.trim() || undefined,
      });
      setMensagem('Dados salvos.');
      onSalvo();
    } catch (err: any) {
      setErro(err.response?.data?.error?.message ?? 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const ocupacaoPct = Math.min(100, Math.round((viagem.agregados.pessoasConfirmadas / viagem.agregados.capacidade) * 100));

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span>Ocupação</span>
          <span>
            {viagem.agregados.pessoasConfirmadas} / {viagem.agregados.capacidade}
          </span>
        </div>
        <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden">
          <div className="h-full bg-amber-400" style={{ width: `${ocupacaoPct}%` }} />
        </div>
        <div className="flex gap-4 mt-3 text-xs">
          <span className="text-emerald-700 font-semibold">Recebido: {formatMoeda(viagem.agregados.totalRecebido)}</span>
          <span className="text-red-700 font-semibold">Despesas: {formatMoeda(viagem.agregados.totalDespesas)}</span>
        </div>
      </div>

      <Input label="Nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            label="Destino (cidade)"
            required
            value={form.destinoCidade}
            onChange={(e) => setForm({ ...form, destinoCidade: e.target.value })}
          />
        </div>
        <div className="w-20">
          <Input
            label="UF"
            maxLength={2}
            required
            value={form.destinoUf}
            onChange={(e) => setForm({ ...form, destinoUf: e.target.value.toUpperCase() })}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            label="Data início"
            type="date"
            required
            value={form.dataInicio}
            onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
          />
        </div>
        <div className="flex-1">
          <Input
            label="Data fim"
            type="date"
            required
            value={form.dataFim}
            onChange={(e) => setForm({ ...form, dataFim: e.target.value })}
          />
        </div>
      </div>
      <Input
        label="Capacidade"
        type="number"
        min={1}
        required
        value={form.capacidade}
        onChange={(e) => setForm({ ...form, capacidade: e.target.value })}
      />
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            label="Preço titular (R$)"
            type="number"
            min={0}
            step="0.01"
            required
            value={form.precoTitular}
            onChange={(e) => setForm({ ...form, precoTitular: e.target.value })}
          />
        </div>
        <div className="flex-1">
          <Input
            label="Preço acompanhante (R$)"
            type="number"
            min={0}
            step="0.01"
            value={form.precoAcompanhante}
            onChange={(e) => setForm({ ...form, precoAcompanhante: e.target.value })}
          />
        </div>
      </div>
      <label className="block text-xs text-zinc-500">
        Descrição
        <textarea
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          rows={3}
          className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </label>

      {erro && <p className="text-red-600 text-xs">{erro}</p>}
      {mensagem && <p className="text-emerald-700 text-xs">{mensagem}</p>}
      <Button type="submit" disabled={salvando}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  );
}

function Hospedagem({
  viagemId,
  hoteis,
  onAtualizado,
}: {
  viagemId: string;
  hoteis: Hotel[];
  onAtualizado: () => void;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ nome: '', cidade: '', checkIn: '', checkOut: '', valorNegociado: '' });
  const [enviando, setEnviando] = useState(false);

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post(`/viagens/${viagemId}/hoteis`, {
        nome: form.nome,
        cidade: form.cidade.trim() || undefined,
        checkIn: form.checkIn || undefined,
        checkOut: form.checkOut || undefined,
        valorNegociado: form.valorNegociado ? Number(form.valorNegociado) : undefined,
      });
      setForm({ nome: '', cidade: '', checkIn: '', checkOut: '', valorNegociado: '' });
      setMostrarForm(false);
      onAtualizado();
    } finally {
      setEnviando(false);
    }
  };

  const remover = async (id: string) => {
    if (!window.confirm('Remover este hotel?')) return;
    await api.delete(`/viagens/${viagemId}/hoteis/${id}`);
    onAtualizado();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-zinc-900">Hospedagem</h3>
        <button
          type="button"
          onClick={() => setMostrarForm((v) => !v)}
          className="text-xs font-semibold text-amber-600 hover:text-amber-700"
        >
          {mostrarForm ? 'Cancelar' : '+ Adicionar hotel'}
        </button>
      </div>

      <div className="space-y-2 mb-3">
        {hoteis.length === 0 && !mostrarForm && <p className="text-xs text-zinc-400">Nenhum hotel cadastrado.</p>}
        {hoteis.map((h) => (
          <div key={h.id} className="border border-stone-200 rounded-lg p-3 flex items-start justify-between">
            <div>
              <p className="font-semibold text-sm text-zinc-900">{h.nome}</p>
              {h.cidade && <p className="text-xs text-zinc-500">{h.cidade}</p>}
              <p className="text-xs text-zinc-600 mt-1">
                Check-in {formatData(h.checkIn)} · Check-out {formatData(h.checkOut)}
              </p>
              {h.valorNegociado && <p className="text-xs text-zinc-600">{formatMoeda(h.valorNegociado)}</p>}
            </div>
            <button
              type="button"
              onClick={() => remover(h.id)}
              aria-label={`Remover ${h.nome}`}
              className="text-zinc-400 hover:text-red-600"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {mostrarForm && (
        <form onSubmit={adicionar} className="border border-stone-200 rounded-lg p-3 space-y-2">
          <Input label="Nome do hotel" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <Input label="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Check-in"
                type="date"
                value={form.checkIn}
                onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
              />
            </div>
            <div className="flex-1">
              <Input
                label="Check-out"
                type="date"
                value={form.checkOut}
                onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
              />
            </div>
          </div>
          <Input
            label="Valor negociado (R$)"
            type="number"
            min={0}
            step="0.01"
            value={form.valorNegociado}
            onChange={(e) => setForm({ ...form, valorNegociado: e.target.value })}
          />
          <Button type="submit" disabled={enviando} className="w-full">
            {enviando ? 'Adicionando…' : 'Adicionar'}
          </Button>
        </form>
      )}
    </div>
  );
}

const TIPO_LABEL: Record<AtracaoTipo, string> = {
  parque: 'Parque',
  passeio: 'Passeio',
  refeicao: 'Refeição',
  outro: 'Outro',
};

function AtracaoSecao({
  viagemId,
  atracoes,
  onAtualizado,
}: {
  viagemId: string;
  atracoes: Atracao[];
  onAtualizado: () => void;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState<{ nome: string; tipo: AtracaoTipo; valorEntrada: string; incluso: boolean }>({
    nome: '',
    tipo: 'parque',
    valorEntrada: '',
    incluso: false,
  });
  const [enviando, setEnviando] = useState(false);

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post(`/viagens/${viagemId}/atracoes`, {
        nome: form.nome,
        tipo: form.tipo,
        valorEntrada: form.valorEntrada ? Number(form.valorEntrada) : undefined,
        incluso: form.incluso,
      });
      setForm({ nome: '', tipo: 'parque', valorEntrada: '', incluso: false });
      setMostrarForm(false);
      onAtualizado();
    } finally {
      setEnviando(false);
    }
  };

  const remover = async (id: string) => {
    if (!window.confirm('Remover esta atração?')) return;
    await api.delete(`/viagens/${viagemId}/atracoes/${id}`);
    onAtualizado();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-zinc-900">Parques e atrações</h3>
        <button
          type="button"
          onClick={() => setMostrarForm((v) => !v)}
          className="text-xs font-semibold text-amber-600 hover:text-amber-700"
        >
          {mostrarForm ? 'Cancelar' : '+ Adicionar atração'}
        </button>
      </div>

      <div className="space-y-2 mb-3">
        {atracoes.length === 0 && !mostrarForm && <p className="text-xs text-zinc-400">Nenhuma atração cadastrada.</p>}
        {atracoes.map((a) => (
          <div key={a.id} className="border border-stone-200 rounded-lg p-3 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-zinc-900">{a.nome}</p>
                <Pill>{TIPO_LABEL[a.tipo]}</Pill>
                {a.incluso && <Pill cls="bg-emerald-100 text-emerald-700 border border-emerald-200">Incluso</Pill>}
              </div>
              {a.valorEntrada && <p className="text-xs text-zinc-600 mt-1">{formatMoeda(a.valorEntrada)}</p>}
            </div>
            <button
              type="button"
              onClick={() => remover(a.id)}
              aria-label={`Remover ${a.nome}`}
              className="text-zinc-400 hover:text-red-600"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {mostrarForm && (
        <form onSubmit={adicionar} className="border border-stone-200 rounded-lg p-3 space-y-2">
          <Input label="Nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <Select label="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as AtracaoTipo })}>
            <option value="parque">Parque</option>
            <option value="passeio">Passeio</option>
            <option value="refeicao">Refeição</option>
            <option value="outro">Outro</option>
          </Select>
          <Input
            label="Valor de entrada (R$)"
            type="number"
            min={0}
            step="0.01"
            value={form.valorEntrada}
            onChange={(e) => setForm({ ...form, valorEntrada: e.target.value })}
          />
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={form.incluso}
              onChange={(e) => setForm({ ...form, incluso: e.target.checked })}
            />
            Incluso no pacote
          </label>
          <Button type="submit" disabled={enviando} className="w-full">
            {enviando ? 'Adicionando…' : 'Adicionar'}
          </Button>
        </form>
      )}
    </div>
  );
}

function InclusosSecao({
  viagemId,
  inclusos,
  onAtualizado,
}: {
  viagemId: string;
  inclusos: Incluso[];
  onAtualizado: () => void;
}) {
  const [novo, setNovo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const adicionar = async () => {
    const descricao = novo.trim();
    if (!descricao) return;
    setEnviando(true);
    try {
      await api.post(`/viagens/${viagemId}/inclusos`, { descricao, ordem: inclusos.length });
      setNovo('');
      onAtualizado();
    } finally {
      setEnviando(false);
    }
  };

  const remover = async (id: string) => {
    await api.delete(`/viagens/${viagemId}/inclusos/${id}`);
    onAtualizado();
  };

  return (
    <div>
      <h3 className="text-sm font-bold text-zinc-900 mb-2">O que está incluso</h3>
      <div className="flex flex-wrap gap-2 mb-2">
        {inclusos.map((i) => (
          <span
            key={i.id}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-zinc-900 text-amber-400"
          >
            {i.descricao}
            <button type="button" onClick={() => remover(i.id)} aria-label={`Remover ${i.descricao}`} className="hover:text-white">
              <X size={12} />
            </button>
          </span>
        ))}
        {inclusos.length === 0 && <span className="text-xs text-zinc-400">Nada cadastrado ainda</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              adicionar();
            }
          }}
          placeholder="Ex.: café da manhã"
          className="flex-1 border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          type="button"
          onClick={adicionar}
          disabled={enviando}
          className="px-3 rounded-lg border border-stone-300 text-zinc-600 hover:border-amber-400 hover:text-zinc-900 disabled:opacity-50"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
