import { ChevronLeft, ChevronRight, Search, UserPlus } from 'lucide-react';
import { formatCidade } from '../lib/paises';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ClienteListItem } from '../types/cliente';
import { Modal } from './Modal';

const POR_PAGINA = 10;

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onSelecionar: (cliente: ClienteListItem) => void;
  /** Clientes que já estão na viagem: aparecem, mas não podem ser escolhidos. */
  idsIndisponiveis?: Set<string>;
  onCadastrarNovo?: () => void;
}

/**
 * Pesquisa de clientes cadastrados: abre já listando a base (paginada),
 * com filtro por nome, telefone ou cidade. Clique para marcar, duplo clique
 * (ou "Selecionar") para confirmar.
 */
export function PesquisaClienteModal({ aberto, onFechar, onSelecionar, idsIndisponiveis, onCadastrarNovo }: Props) {
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [clientes, setClientes] = useState<ClienteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [marcado, setMarcado] = useState<ClienteListItem | null>(null);

  useEffect(() => {
    if (aberto) {
      setBusca('');
      setPagina(1);
      setMarcado(null);
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    const timer = setTimeout(
      async () => {
        setCarregando(true);
        setErro('');
        try {
          const { data } = await api.get('/clientes', {
            params: { busca: busca.trim() || undefined, pagina, porPagina: POR_PAGINA },
          });
          if (!ativo) return;
          setClientes(data.clientes);
          setTotal(data.paginacao.total);
          setTotalPaginas(data.paginacao.totalPaginas);
        } catch {
          if (ativo) setErro('Não foi possível carregar os clientes.');
        } finally {
          if (ativo) setCarregando(false);
        }
      },
      busca ? 300 : 0,
    );
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [aberto, busca, pagina]);

  const disponivel = (c: ClienteListItem) => !c.anonimizadoEm && !idsIndisponiveis?.has(c.id);

  const confirmar = (c: ClienteListItem | null) => {
    if (!c || !disponivel(c)) return;
    onSelecionar(c);
    onFechar();
  };

  const motivoIndisponivel = (c: ClienteListItem) =>
    c.anonimizadoEm ? 'Anonimizado' : idsIndisponiveis?.has(c.id) ? 'Já inscrito' : null;

  const inicio = total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1;
  const fim = Math.min(total, pagina * POR_PAGINA);

  return (
    <Modal titulo="Pesquisar cliente" aberto={aberto} onFechar={onFechar} largura="lg">
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
              setMarcado(null);
            }}
            placeholder="Nome, telefone ou cidade"
            className="w-full h-11 md:h-9 pl-9 pr-3 rounded-md border border-slate-200 bg-white text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
        </label>
        {onCadastrarNovo && (
          <button
            type="button"
            onClick={onCadastrarNovo}
            className="h-11 md:h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 text-sm md:text-xs font-semibold text-brand hover:border-brand-border"
          >
            <UserPlus size={14} /> Cadastrar novo
          </button>
        )}
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {/* Desktop: tabela */}
      <div className="hidden sm:block border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Nome</th>
              <th className="text-left font-semibold px-3 py-2">Telefone</th>
              <th className="text-left font-semibold px-3 py-2">Cidade/UF</th>
              <th className="text-left font-semibold px-3 py-2">Viagens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clientes.map((c) => {
              const motivo = motivoIndisponivel(c);
              const ativo = marcado?.id === c.id;
              return (
                <tr
                  key={c.id}
                  onClick={() => !motivo && setMarcado(c)}
                  onDoubleClick={() => confirmar(c)}
                  className={
                    motivo
                      ? 'text-slate-400 cursor-not-allowed'
                      : ativo
                        ? 'bg-brand-soft cursor-pointer'
                        : 'hover:bg-slate-50 cursor-pointer'
                  }
                >
                  <td className="px-3 py-2">
                    <span className={motivo ? '' : 'font-medium text-slate-900'}>{c.nome}</span>
                    {motivo && (
                      <span className="ml-2 text-[11px] rounded border border-slate-200 px-1.5 py-0.5">{motivo}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{c.telefone}</td>
                  <td className="px-3 py-2">{formatCidade(c) || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{c.viagens.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!carregando && clientes.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-6">
            {busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
          </p>
        )}
      </div>

      {/* Celular: lista de toque */}
      <ul className="sm:hidden space-y-2">
        {clientes.map((c) => {
          const motivo = motivoIndisponivel(c);
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={!!motivo}
                onClick={() => confirmar(c)}
                className="w-full text-left rounded-lg border border-slate-200 p-3 disabled:opacity-50 active:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{c.nome}</span>
                  {motivo && <span className="text-[11px] text-slate-500">{motivo}</span>}
                </div>
                <p className="text-xs text-slate-500">
                  {c.telefone}
                  {c.cidade ? ` · ${formatCidade(c)}` : ''}
                </p>
              </button>
            </li>
          );
        })}
        {!carregando && clientes.length === 0 && (
          <li className="text-sm text-slate-500 text-center py-6">
            {busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
          </li>
        )}
      </ul>

      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>{carregando ? 'Carregando…' : total > 0 ? `${inicio}–${fim} de ${total}` : ''}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pagina <= 1 || carregando}
            onClick={() => setPagina((p) => p - 1)}
            aria-label="Página anterior"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-1">
            {pagina} / {totalPaginas}
          </span>
          <button
            type="button"
            disabled={pagina >= totalPaginas || carregando}
            onClick={() => setPagina((p) => p + 1)}
            aria-label="Próxima página"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="hidden sm:flex justify-end gap-2 border-t border-slate-200 pt-3 -mx-5 px-5">
        <button
          type="button"
          onClick={onFechar}
          className="h-9 px-4 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!marcado}
          onClick={() => confirmar(marcado)}
          className="h-9 px-4 rounded-md bg-brand text-white text-xs font-semibold hover:bg-brand-hover disabled:opacity-40"
        >
          Selecionar
        </button>
      </div>
    </Modal>
  );
}
