import { Check, CloudOff, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import {
  filaPendente,
  lerLista,
  marcarLocal,
  salvarLista,
  sincronizar,
  type InscritoOffline,
} from '../lib/embarqueOffline';
import type { InscricoesDaViagem, ViagemDetalhe } from '../types/viagem';
import { ContatoAcoes } from './ContatoAcoes';
import { Pill } from './Pill';

const PILL_PAGAMENTO: Record<string, { label: string; cls: string }> = {
  pendente: { label: 'Não pagou', cls: 'bg-red-50 text-red-700 border border-red-200' },
  parcial: { label: 'Pagou parte', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
};

function horaCurta(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function pessoas(i: InscritoOffline) {
  return i.nomeAcompanhante ? 2 : 1;
}

type Filtro = 'faltam' | 'embarcados' | 'todos';

/** Lista de embarque — usada no drawer da viagem (online) e na tela sem internet. */
export function ListaEmbarque({
  inscritos,
  onAlternar,
  somenteLeitura,
  pendentes,
}: {
  inscritos: InscritoOffline[];
  onAlternar: (inscrito: InscritoOffline) => void;
  somenteLeitura?: boolean;
  pendentes: number;
}) {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('faltam');

  const total = inscritos.reduce((s, i) => s + pessoas(i), 0);
  const embarcadas = inscritos.filter((i) => i.embarcadoEm).reduce((s, i) => s + pessoas(i), 0);
  const pct = total ? Math.round((embarcadas / total) * 100) : 0;

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return inscritos
      .filter((i) => (filtro === 'faltam' ? !i.embarcadoEm : filtro === 'embarcados' ? !!i.embarcadoEm : true))
      .filter(
        (i) =>
          !termo ||
          i.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
          (i.nomeAcompanhante ?? '').toLocaleLowerCase('pt-BR').includes(termo),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [inscritos, busca, filtro]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-500">Embarcados</span>
          <span className="font-mono text-lg font-semibold text-slate-900">
            {embarcadas}
            <span className="text-slate-400 text-sm"> / {total} pessoas</span>
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full ${embarcadas === total && total > 0 ? 'bg-emerald-500' : 'bg-brand'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pendentes > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
            <CloudOff size={13} /> {pendentes} marcação(ões) guardada(s) no aparelho — envio automático quando
            voltar a internet.
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <label className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pelo nome"
            className="w-full h-11 md:h-9 pl-9 pr-3 rounded-md border border-slate-200 bg-white text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
        </label>
        <div className="grid grid-cols-3 rounded-md border border-slate-200 bg-white p-0.5 text-xs font-medium">
          {(
            [
              ['faltam', 'Faltam'],
              ['embarcados', 'Embarcados'],
              ['todos', 'Todos'],
            ] as [Filtro, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              className={`h-10 md:h-8 px-3 rounded ${filtro === id ? 'bg-brand-soft text-brand-ink' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">
          {filtro === 'faltam' && !busca && total > 0 ? 'Todo mundo embarcou. 🎉' : 'Ninguém nesta lista.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((i) => {
            const pag = PILL_PAGAMENTO[i.statusPagamento];
            return (
              <li
                key={i.id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  i.embarcadoEm ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  disabled={somenteLeitura}
                  onClick={() => onAlternar(i)}
                  aria-pressed={!!i.embarcadoEm}
                  aria-label={i.embarcadoEm ? `Desfazer embarque de ${i.nome}` : `Marcar embarque de ${i.nome}`}
                  className={`shrink-0 h-11 w-11 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-50 ${
                    i.embarcadoEm
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-slate-300 text-transparent hover:border-brand'
                  }`}
                >
                  <Check size={22} strokeWidth={3} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{i.nome}</p>
                  {i.nomeAcompanhante && (
                    <p className="text-xs text-slate-500 truncate">+ {i.nomeAcompanhante}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {i.embarcadoEm && (
                      <span className="text-xs text-emerald-700">Embarcou às {horaCurta(i.embarcadoEm)}</span>
                    )}
                    {pag && <Pill cls={pag.cls}>{pag.label}</Pill>}
                  </div>
                </div>
                <ContatoAcoes telefone={i.telefone} nome={i.nome} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const STATUS_COM_EMBARQUE = new Set(['inscricoes', 'confirmada']);

function semRede(err: unknown) {
  return !(err as { response?: unknown }).response;
}

export function AbaEmbarque({ viagem }: { viagem: ViagemDetalhe }) {
  const [inscritos, setInscritos] = useState<InscritoOffline[] | null>(null);
  const [pendentes, setPendentes] = useState(0);
  const [erro, setErro] = useState('');
  const [offline, setOffline] = useState(false);
  const podeMarcar = STATUS_COM_EMBARQUE.has(viagem.status);

  const contarPendentes = () => setPendentes(filaPendente().filter((m) => m.viagemId === viagem.id).length);

  const persistir = (lista: InscritoOffline[]) => {
    salvarLista({
      viagem: {
        id: viagem.id,
        nome: viagem.nome,
        destino: `${viagem.destinoCidade}/${viagem.destinoUf}`,
        dataInicio: viagem.dataInicio,
        dataFim: viagem.dataFim,
      },
      inscritos: lista,
    });
  };

  const carregar = async () => {
    try {
      await sincronizar();
      const { data } = await api.get<InscricoesDaViagem>(`/viagens/${viagem.id}/inscricoes`);
      const lista: InscritoOffline[] = data.inscricoes
        .filter((i) => i.status === 'confirmada')
        .map((i) => ({
          id: i.id,
          nome: i.cliente.nome,
          telefone: i.cliente.telefone,
          nomeAcompanhante: i.levaAcompanhante ? (i.nomeAcompanhante ?? 'Acompanhante') : null,
          statusPagamento: i.statusPagamento,
          embarcadoEm: i.embarcadoEm,
        }));
      if (podeMarcar) persistir(lista);
      setInscritos(podeMarcar ? (lerLista(viagem.id)?.inscritos ?? lista) : lista);
      setOffline(false);
    } catch (err) {
      const salva = lerLista(viagem.id);
      if (semRede(err) && salva) {
        setInscritos(salva.inscritos);
        setOffline(true);
      } else {
        setErro('Não foi possível carregar a lista de embarque.');
      }
    }
    contarPendentes();
  };

  useEffect(() => {
    carregar();
    const aoVoltar = () => carregar();
    window.addEventListener('online', aoVoltar);
    return () => window.removeEventListener('online', aoVoltar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viagem.id]);

  const alternar = async (alvo: InscritoOffline) => {
    const embarcado = !alvo.embarcadoEm;
    setErro('');
    // Otimista: a marcação aparece na hora, mesmo antes da resposta.
    const local = marcarLocal(viagem.id, alvo.id, embarcado);
    setInscritos((atual) => atual?.map((i) => (i.id === alvo.id ? { ...i, embarcadoEm: local } : i)) ?? null);
    contarPendentes();
    if (!navigator.onLine) {
      setOffline(true);
      return;
    }
    try {
      await sincronizar();
      setOffline(false);
    } catch {
      /* fica na fila */
    }
    const restante = filaPendente().some((m) => m.inscricaoId === alvo.id);
    contarPendentes();
    if (!restante) {
      // Confirma com o servidor (pode ter sido recusada: inscrição cancelada etc.)
      try {
        const { data } = await api.get<InscricoesDaViagem>(`/viagens/${viagem.id}/inscricoes`);
        const servidor = data.inscricoes.find((i) => i.id === alvo.id);
        if (servidor && !!servidor.embarcadoEm !== embarcado) {
          setErro(`Não foi possível marcar o embarque de ${alvo.nome}.`);
        }
        await carregar();
      } catch {
        setOffline(true);
      }
    }
  };

  if (!inscritos) {
    return erro ? <p className="text-sm text-red-600">{erro}</p> : <p className="text-sm text-slate-500">Carregando…</p>;
  }

  return (
    <div className="space-y-3">
      {!podeMarcar && (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          O embarque só pode ser marcado com a viagem em "Inscrições abertas" ou "Confirmada".
        </p>
      )}
      {offline && (
        <p className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <CloudOff size={13} /> Sem internet — mostrando a lista salva neste aparelho.
        </p>
      )}
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <ListaEmbarque inscritos={inscritos} onAlternar={alternar} somenteLeitura={!podeMarcar} pendentes={pendentes} />
      {podeMarcar && (
        <p className="text-[11px] text-slate-400">
          A lista (nome, telefone e situação, sem CPF) fica salva neste aparelho para usar sem internet e é apagada ao
          sair da conta ou dois dias após o fim da viagem.
        </p>
      )}
    </div>
  );
}
