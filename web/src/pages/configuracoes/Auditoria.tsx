import { Fragment, useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Pill } from '../../components/Pill';
import { Select } from '../../components/Select';
import { api } from '../../lib/api';

interface ItemAuditoria {
  id: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  usuarioNome: string;
  dados: unknown;
  ip: string | null;
  createdAt: string;
}

interface Resposta {
  itens: ItemAuditoria[];
  total: number;
  page: number;
  pageSize: number;
  filtros: { usuarios: { id: string; nome: string }[]; entidades: string[] };
}

const ACOES: Record<string, { label: string; cls: string }> = {
  create: { label: 'criação', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  update: { label: 'alteração', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
  delete: { label: 'exclusão', cls: 'bg-red-100 text-red-700 border border-red-200' },
  login: { label: 'login', cls: 'bg-stone-100 text-zinc-700 border border-stone-200' },
  export: { label: 'exportação', cls: 'bg-sky-100 text-sky-700 border border-sky-200' },
  anonimizacao: { label: 'anonimização', cls: 'bg-zinc-900 text-amber-400' },
};

const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function Auditoria() {
  const [filtros, setFiltros] = useState({ userId: '', entidade: '', acao: '', de: '', ate: '' });
  const [page, setPage] = useState(1);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = async (pagina = page) => {
    const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
    const { data } = await api.get('/auditoria', { params: { ...params, page: pagina, pageSize: 30 } });
    setDados(data);
  };

  useEffect(() => {
    carregar(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const aplicar = (e: React.FormEvent) => {
    e.preventDefault();
    if (page === 1) carregar(1);
    else setPage(1);
  };

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <form onSubmit={aplicar} className="bg-white rounded-xl border border-stone-200 p-4 grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <Select label="Usuário" value={filtros.userId} onChange={(e) => setFiltros({ ...filtros, userId: e.target.value })}>
          <option value="">Todos</option>
          {dados?.filtros.usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </Select>
        <Select label="Entidade" value={filtros.entidade} onChange={(e) => setFiltros({ ...filtros, entidade: e.target.value })}>
          <option value="">Todas</option>
          {dados?.filtros.entidades.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
        <Select label="Ação" value={filtros.acao} onChange={(e) => setFiltros({ ...filtros, acao: e.target.value })}>
          <option value="">Todas</option>
          {Object.entries(ACOES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <Input label="De" type="date" value={filtros.de} onChange={(e) => setFiltros({ ...filtros, de: e.target.value })} />
        <Input label="Até" type="date" value={filtros.ate} onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })} />
        <Button type="submit">Filtrar</Button>
      </form>

      {!dados ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : dados.itens.length === 0 ? (
        <EmptyState titulo="Nenhum registro" descricao="Nada encontrado com esses filtros." />
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs text-zinc-500">
              <tr>
                <th className="text-left px-4 py-2">Quando</th>
                <th className="text-left px-4 py-2">Usuário</th>
                <th className="text-left px-4 py-2">Ação</th>
                <th className="text-left px-4 py-2">Entidade</th>
                <th className="text-left px-4 py-2">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {dados.itens.map((i) => (
                <Fragment key={i.id}>
                  <tr
                    className="cursor-pointer hover:bg-stone-50"
                    onClick={() => setAberto(aberto === i.id ? null : i.id)}
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-zinc-600">{dataHora.format(new Date(i.createdAt))}</td>
                    <td className="px-4 py-2">{i.usuarioNome}</td>
                    <td className="px-4 py-2">
                      <Pill cls={ACOES[i.acao]?.cls}>{ACOES[i.acao]?.label ?? i.acao}</Pill>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">
                      {i.entidade}
                      {i.entidadeId && <span className="text-xs text-zinc-400"> · {i.entidadeId.slice(0, 8)}</span>}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-400">{i.ip ?? '—'}</td>
                  </tr>
                  {aberto === i.id && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 bg-stone-50">
                        <pre className="text-xs text-zinc-600 whitespace-pre-wrap break-all">
                          {i.dados ? JSON.stringify(i.dados, null, 2) : 'Sem detalhes.'}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dados && dados.total > dados.pageSize && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>
            {dados.total} registros · página {page} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <Button variant="secondary" disabled={page >= totalPaginas} onClick={() => setPage(page + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
