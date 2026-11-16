import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '../components/EmptyState';
import { type Aba, ViagemDrawer } from '../components/ViagemDrawer';
import { api } from '../lib/api';
import { formatBRL, formatDataCivil } from '../lib/format';
import type { Dashboard as DashboardData } from '../types/viagem';

const brlCompacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function diasAte(dataIso: string, hojeIso: string) {
  const ms = Date.parse(dataIso.slice(0, 10)) - Date.parse(hojeIso.slice(0, 10));
  return Math.round(ms / 86_400_000);
}

export function Dashboard() {
  const [dados, setDados] = useState<DashboardData | null>(null);
  const [drawer, setDrawer] = useState<{ viagemId: string; aba: Aba } | null>(null);

  const carregar = () => api.get('/dashboard').then(({ data }) => setDados(data));

  useEffect(() => {
    carregar();
  }, []);

  if (!dados) return <p className="text-sm text-zinc-500">Carregando…</p>;

  const totalPendente = dados.pendencias.reduce((s, p) => s + Number(p.saldo), 0);
  const grafico = dados.resultadoPorViagem.map((v) => ({
    nome: v.nome.length > 18 ? `${v.nome.slice(0, 17)}…` : v.nome,
    Recebido: Number(v.recebido),
    Despesas: Number(v.despesas),
    Resultado: Number(v.resultadoAtual),
  }));

  return (
    <div className="space-y-6">
      <div>
          <h1 className="text-base font-semibold text-slate-900">Visão geral</h1>
          <p className="text-xs text-slate-500">Resumo financeiro e próximas viagens</p>
        </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi titulo="A receber (viagens do mês)" valor={formatBRL(dados.aReceberNoMes)} cls="text-brand" />
        <Kpi
          titulo="Pendências (viagens em até 30 dias)"
          valor={formatBRL(totalPendente)}
          detalhe={`${dados.pendencias.length} inscrição(ões)`}
          cls={totalPendente > 0 ? 'text-red-700' : 'text-zinc-900'}
        />
        <Kpi titulo="Próximas viagens" valor={String(dados.proximasViagens.length)} cls="text-zinc-900" />
      </div>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Próximas viagens</h2>
        {dados.proximasViagens.length === 0 ? (
          <EmptyState titulo="Nenhuma viagem futura" descricao="Cadastre uma viagem na aba Viagens." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dados.proximasViagens.map((v) => {
              const pct = Math.min(100, Math.round((v.pessoasConfirmadas / v.capacidade) * 100));
              const dias = diasAte(v.dataInicio, dados.hoje);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setDrawer({ viagemId: v.id, aba: 'resumo' })}
                  className="text-left bg-white rounded-xl border border-stone-200 shadow-card overflow-hidden hover:border-brand transition-colors"
                >
                  <div className="p-4">
                    <p className="font-semibold text-zinc-900">{v.nome}</p>
                    <p className="text-xs text-zinc-500">
                      {v.destinoCidade}/{v.destinoUf} · {formatDataCivil(v.dataInicio)}{' '}
                      <span className="text-zinc-400">({dias === 0 ? 'hoje' : `em ${dias} dia${dias > 1 ? 's' : ''}`})</span>
                    </p>
                    <div className="mt-3 mb-2">
                      <div className="flex justify-between text-xs text-zinc-500 mb-1">
                        <span>Ocupação</span>
                        <span>
                          {v.pessoasConfirmadas} / {v.capacidade}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden">
                        <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span className="text-emerald-700 font-semibold">{formatBRL(v.recebido)} recebido</span>
                      {Number(v.aReceber) > 0 && (
                        <span className="text-brand font-semibold">{formatBRL(v.aReceber)} a receber</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Pagamentos pendentes — viagens nos próximos 30 dias</h2>
        {dados.pendencias.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhuma pendência. 🎉</p>
        ) : (
          <ul className="bg-white border border-stone-200 rounded-xl shadow-card divide-y divide-stone-200">
            {dados.pendencias.map((p) => (
              <li key={p.inscricaoId}>
                <button
                  type="button"
                  onClick={() => setDrawer({ viagemId: p.viagemId, aba: 'clientes' })}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-stone-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{p.clienteNome}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {p.viagemNome} · {formatDataCivil(p.dataInicio)} · {p.clienteTelefone}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-700">{formatBRL(p.saldo)}</p>
                    <p className="text-xs text-zinc-400">
                      pago {formatBRL(p.valorPago)} de {formatBRL(p.valorTotal)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Resultado por viagem</h2>
        {grafico.length === 0 ? (
          <p className="text-sm text-zinc-400">Sem viagens ainda.</p>
        ) : (
          <div className="bg-white border border-stone-200 rounded-xl shadow-card p-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis tickFormatter={(v) => brlCompacto.format(v)} tick={{ fontSize: 11, fill: '#71717a' }} width={70} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Recebido" fill="#059669" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Despesas" fill="#dc2626" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Resultado" fill="#1C69D4" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <ViagemDrawer
        viagemId={drawer?.viagemId ?? null}
        abaInicial={drawer?.aba}
        onFechar={() => setDrawer(null)}
        onAtualizado={carregar}
      />
    </div>
  );
}

function Kpi({ titulo, valor, detalhe, cls }: { titulo: string; valor: string; detalhe?: string; cls: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-card p-4">
      <p className="text-xs text-zinc-500">{titulo}</p>
      <p className={`text-xl font-semibold font-mono mt-1 tracking-tight ${cls}`}>{valor}</p>
      {detalhe && <p className="text-xs text-zinc-400 mt-1">{detalhe}</p>}
    </div>
  );
}
