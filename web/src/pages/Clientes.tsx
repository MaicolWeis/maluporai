import { useEffect, useState } from 'react';
import { ClienteDrawer } from '../components/ClienteDrawer';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { NovoClienteModal } from '../components/NovoClienteModal';
import { Pill } from '../components/Pill';
import { api } from '../lib/api';
import type { ClienteListItem } from '../types/cliente';

export function Clientes() {
  const [clientes, setClientes] = useState<ClienteListItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | null>(null);

  const carregar = async (termoBusca: string) => {
    setCarregando(true);
    try {
      const { data } = await api.get('/clientes', { params: termoBusca ? { busca: termoBusca } : {} });
      setClientes(data.clientes);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => carregar(busca), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Clientes</h1>
          <p className="text-xs text-slate-500">Cadastro de viajantes e privacidade (LGPD)</p>
        </div>
        <Button onClick={() => setModalAberto(true)}>Novo cliente</Button>
      </div>

      <div className="mb-4 max-w-sm">
        <Input
          label="Buscar"
          placeholder="Nome, telefone ou cidade"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {carregando ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : clientes.length === 0 ? (
        <EmptyState
          titulo="Nenhum cliente ainda"
          descricao="Cadastre o primeiro cliente pra começar a organizar as viagens."
        />
      ) : (
        <>
        <ul className="md:hidden space-y-2">
          {clientes.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setClienteSelecionadoId(c.id)}
                className="w-full text-left bg-white rounded-xl border border-slate-200 shadow-card p-3 active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {c.nome}
                    {c.anonimizadoEm && <span className="ml-1 text-xs font-normal text-slate-400">(anonimizado)</span>}
                  </p>
                  {c.consentimentoMarketing && (
                    <Pill cls="bg-emerald-50 text-emerald-700 border border-emerald-200">Marketing</Pill>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {c.telefone}
                  {c.cidade ? ` · ${c.cidade}${c.uf ? `/${c.uf}` : ''}` : ''}
                </p>
                {c.viagens.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.viagens.map((v) => (
                      <Pill key={v.id}>{v.nome}</Pill>
                    ))}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="hidden md:block bg-white rounded-xl border border-stone-200 shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold">Telefone</th>
                <th className="px-4 py-3 font-semibold">Cidade</th>
                <th className="px-4 py-3 font-semibold">Viagens</th>
                <th className="px-4 py-3 font-semibold">Consentimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {clientes.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setClienteSelecionadoId(c.id)}
                  className="cursor-pointer hover:bg-stone-50"
                >
                  <td className="px-4 py-3 font-semibold text-zinc-900">
                    {c.nome}
                    {c.anonimizadoEm && (
                      <span className="ml-2 text-xs font-normal text-zinc-400">(anonimizado)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{c.telefone}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.viagens.length === 0 ? (
                        <span className="text-xs text-zinc-400">—</span>
                      ) : (
                        c.viagens.map((v) => <Pill key={v.id}>{v.nome}</Pill>)
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      cls={
                        c.consentimentoMarketing
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-stone-100 text-zinc-600 border border-stone-200'
                      }
                    >
                      {c.consentimentoMarketing ? 'Aceito' : 'Não aceito'}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      <NovoClienteModal aberto={modalAberto} onFechar={() => setModalAberto(false)} onCriado={() => carregar(busca)} />

      <ClienteDrawer
        clienteId={clienteSelecionadoId}
        onFechar={() => setClienteSelecionadoId(null)}
        onAtualizado={() => carregar(busca)}
      />
    </div>
  );
}
