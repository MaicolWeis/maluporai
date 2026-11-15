import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatBRL } from '../lib/format';
import type { FinanceiroViagem } from '../types/viagem';

export function AbaFinanceiro({ viagemId }: { viagemId: string }) {
  const [fin, setFin] = useState<FinanceiroViagem | null>(null);

  useEffect(() => {
    setFin(null);
    api.get(`/viagens/${viagemId}/financeiro`).then(({ data }) => setFin(data.financeiro));
  }, [viagemId]);

  if (!fin) return <p className="text-sm text-zinc-500">Carregando…</p>;

  const linhas: { label: string; valor: string; cls: string; dica?: string }[] = [
    { label: 'Receita prevista', valor: fin.receitaPrevista, cls: 'text-zinc-900', dica: 'Soma das inscrições confirmadas' },
    { label: 'Recebido', valor: fin.recebido, cls: 'text-emerald-700' },
    { label: 'A receber', valor: fin.aReceber, cls: 'text-amber-600', dica: 'Saldo em aberto das confirmadas' },
    { label: 'Despesas', valor: fin.despesas, cls: 'text-red-700' },
    { label: 'A devolver', valor: fin.aDevolver, cls: 'text-zinc-500', dica: 'Pagamentos de inscrições canceladas' },
  ];

  const atualPositivo = Number(fin.resultadoAtual) >= 0;
  const previstoPositivo = Number(fin.resultadoPrevisto) >= 0;

  return (
    <div className="space-y-5">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-stone-200">
          {linhas.map((l) => (
            <tr key={l.label}>
              <td className="py-2">
                <p className="text-zinc-700">{l.label}</p>
                {l.dica && <p className="text-xs text-zinc-400">{l.dica}</p>}
              </td>
              <td className={`py-2 text-right font-semibold whitespace-nowrap ${l.cls}`}>{formatBRL(l.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-3">
        <div
          className={`rounded-xl p-4 border ${
            atualPositivo ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          }`}
        >
          <p className="text-xs text-zinc-500">Resultado atual</p>
          <p className={`text-xl font-black ${atualPositivo ? 'text-emerald-700' : 'text-red-700'}`}>
            {formatBRL(fin.resultadoAtual)}
          </p>
          <p className="text-xs text-zinc-400 mt-1">Recebido − despesas</p>
        </div>
        <div className="rounded-xl p-4 border bg-zinc-900 border-zinc-900 text-white">
          <p className="text-xs text-zinc-400">Resultado previsto</p>
          <p className={`text-xl font-black ${previstoPositivo ? 'text-amber-400' : 'text-red-400'}`}>
            {formatBRL(fin.resultadoPrevisto)}
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            {fin.margemPrevista == null ? 'Sem receita prevista ainda' : `Margem prevista ${fin.margemPrevista.toLocaleString('pt-BR')}%`}
          </p>
        </div>
      </div>

      <p className="text-xs text-zinc-500 leading-relaxed">
        O <strong>resultado atual</strong> mostra o caixa de hoje: o que já entrou menos o que já foi gasto. O{' '}
        <strong>resultado previsto</strong> considera que todas as inscrições confirmadas serão quitadas — a diferença
        entre os dois é o que ainda falta receber.
      </p>
    </div>
  );
}
