import { Cake, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ContatoAcoes } from './ContatoAcoes';

interface Aniversariante {
  clienteId: string;
  nome: string;
  telefone: string;
  dia: number;
  idade: number;
  hoje: boolean;
  jaPassou: boolean;
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Aniversariantes do mês na visão geral, com navegação entre meses e atalho para dar parabéns. */
export function Aniversariantes({ onAbrirCliente }: { onAbrirCliente?: (clienteId: string) => void }) {
  const mesAtual = new Date().getMonth() + 1;
  const [mes, setMes] = useState(mesAtual);
  const [lista, setLista] = useState<Aniversariante[] | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    setLista(null);
    setErro('');
    api
      .get<{ aniversariantes: Aniversariante[] }>('/dashboard/aniversariantes', { params: { mes } })
      .then(({ data }) => ativo && setLista(data.aniversariantes))
      .catch(() => ativo && setErro('Não foi possível carregar os aniversariantes.'));
    return () => {
      ativo = false;
    };
  }, [mes]);

  const mudar = (delta: number) => setMes((m) => ((m - 1 + delta + 12) % 12) + 1);
  const ehMesAtual = mes === mesAtual;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Aniversariantes de {MESES[mes - 1]}
          {lista && lista.length > 0 && <span className="ml-1 normal-case font-normal">({lista.length})</span>}
        </h2>
        <div className="flex items-center gap-1">
          {!ehMesAtual && (
            <button
              type="button"
              onClick={() => setMes(mesAtual)}
              className="h-7 px-2 rounded-md text-xs font-semibold text-brand hover:bg-brand-soft"
            >
              Mês atual
            </button>
          )}
          <button
            type="button"
            onClick={() => mudar(-1)}
            aria-label="Mês anterior"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-brand-border"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => mudar(1)}
            aria-label="Próximo mês"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-brand-border"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-card">
        {erro ? (
          <p className="px-4 py-3 text-sm text-red-600">{erro}</p>
        ) : !lista ? (
          <p className="px-4 py-3 text-sm text-slate-500">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-500">
            Nenhum cliente faz aniversário em {MESES[mes - 1]}.
            <span className="block text-xs text-slate-400 mt-0.5">
              Só aparecem clientes com data de nascimento no cadastro.
            </span>
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
            {lista.map((a) => (
              <li
                key={a.clienteId}
                className={`flex items-center gap-3 px-4 py-2.5 ${a.hoje ? 'bg-amber-50' : ''} ${
                  ehMesAtual && a.jaPassou ? 'opacity-60' : ''
                }`}
              >
                <div
                  className={`shrink-0 w-10 text-center rounded-md py-1 ${
                    a.hoje ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <p className="font-mono text-sm font-semibold leading-none">{String(a.dia).padStart(2, '0')}</p>
                  <p className="text-[10px] uppercase leading-none mt-0.5">{MESES[mes - 1].slice(0, 3)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  {onAbrirCliente ? (
                    <button
                      type="button"
                      onClick={() => onAbrirCliente(a.clienteId)}
                      className="font-semibold text-slate-900 truncate hover:text-brand text-left"
                    >
                      {a.nome}
                    </button>
                  ) : (
                    <p className="font-semibold text-slate-900 truncate">{a.nome}</p>
                  )}
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    {a.hoje ? (
                      <>
                        <Cake size={12} className="text-amber-600" /> Hoje! Completa {a.idade} anos
                      </>
                    ) : ehMesAtual && a.jaPassou ? (
                      <>Completou {a.idade} anos</>
                    ) : (
                      <>Completa {a.idade} anos</>
                    )}
                  </p>
                </div>
                <ContatoAcoes telefone={a.telefone} nome={a.nome} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
