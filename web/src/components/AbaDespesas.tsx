import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatBRL, formatDataCivil, hojeLocalISO } from '../lib/format';
import type { Despesa, DespesasDaViagem, ViagemDetalhe } from '../types/viagem';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { ComprovanteInline } from './FileUpload';
import { Input } from './Input';
import { MoneyInput } from './MoneyInput';
import { Pill } from './Pill';
import { Select } from './Select';

function mensagemErro(err: any, padrao: string) {
  return err?.response?.data?.error?.message ?? padrao;
}

export function AbaDespesas({ viagem, onAtualizado }: { viagem: ViagemDetalhe; onAtualizado: () => void }) {
  const [dados, setDados] = useState<DespesasDaViagem | null>(null);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/despesas/categorias').then(({ data }) => setCategorias(data.categoriasDespesa ?? []));
  }, []);

  const carregar = async () => {
    const { data } = await api.get(`/viagens/${viagem.id}/despesas`);
    setDados(data);
  };

  useEffect(() => {
    setCarregando(true);
    carregar().finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viagem.id]);

  const recarregar = async () => {
    await carregar();
    onAtualizado();
  };

  const excluir = async (d: Despesa) => {
    if (!window.confirm(`Excluir a despesa "${d.descricao}" (${formatBRL(d.valor)})?`)) return;
    await api.delete(`/despesas/${d.id}`);
    recarregar();
  };

  if (carregando || !dados) return <p className="text-sm text-zinc-500">Carregando…</p>;

  return (
    <div className="space-y-4">
      {dados.totalPorCategoria.length > 0 && (
        <p className="text-xs text-zinc-500">
          {dados.totalPorCategoria.map((c, i) => (
            <span key={c.categoria}>
              {i > 0 && ' · '}
              {c.categoria} <span className="font-semibold text-zinc-700">{formatBRL(c.total)}</span>
            </span>
          ))}
        </p>
      )}

      {dados.despesas.length === 0 ? (
        <EmptyState titulo="Nenhuma despesa lançada" descricao="Use o formulário abaixo pra lançar a primeira." />
      ) : (
        <ul className="divide-y divide-stone-200 border border-stone-200 rounded-lg bg-white">
          {dados.despesas.map((d) =>
            editandoId === d.id ? (
              <li key={d.id} className="p-3">
                <FormDespesa
                  viagemId={viagem.id}
                  categorias={categorias}
                  despesa={d}
                  onSalvo={() => {
                    setEditandoId(null);
                    recarregar();
                  }}
                  onCancelar={() => setEditandoId(null)}
                />
              </li>
            ) : (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                <Pill>{d.categoria}</Pill>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-900 truncate">{d.descricao}</p>
                  <p className="text-xs text-zinc-400">{formatDataCivil(d.dataDespesa)}</p>
                </div>
                <span className="text-sm font-semibold text-red-700 whitespace-nowrap">{formatBRL(d.valor)}</span>
                <ComprovanteInline
                  finalidade="comprovante_despesa"
                  entidadeId={d.id}
                  referencia={d.comprovanteUrl}
                  podeEditar
                  onAlterado={carregar}
                />
                <button
                  type="button"
                  title="Editar"
                  onClick={() => setEditandoId(d.id)}
                  className="text-zinc-400 hover:text-zinc-900"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  title="Excluir"
                  onClick={() => excluir(d)}
                  className="text-zinc-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      <div className="border border-stone-200 rounded-lg p-3 bg-stone-50">
        <p className="text-xs font-semibold text-zinc-700 mb-2">Lançar despesa</p>
        <FormDespesa viagemId={viagem.id} categorias={categorias} onSalvo={recarregar} />
      </div>

      <div className="sticky -bottom-6 -mx-6 -mb-6 px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total de despesas</span>
        <span className="text-base font-semibold font-mono text-red-700">{formatBRL(dados.total)}</span>
      </div>
    </div>
  );
}

function FormDespesa({
  viagemId,
  categorias,
  despesa,
  onSalvo,
  onCancelar,
}: {
  viagemId: string;
  categorias: string[];
  despesa?: Despesa;
  onSalvo: () => void;
  onCancelar?: () => void;
}) {
  // Na edição, a categoria atual entra nas opções mesmo se já tiver sido
  // removida das configurações (histórico preservado — regra do P4).
  const opcoes = despesa && !categorias.includes(despesa.categoria) ? [despesa.categoria, ...categorias] : categorias;

  const [categoria, setCategoria] = useState(despesa?.categoria ?? '');
  const [descricao, setDescricao] = useState(despesa?.descricao ?? '');
  const [valor, setValor] = useState(despesa ? String(Number(despesa.valor)) : '');
  const [dataDespesa, setDataDespesa] = useState(despesa?.dataDespesa.slice(0, 10) ?? hojeLocalISO());
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!categoria && opcoes.length > 0) setCategoria(opcoes[0]);
  }, [opcoes, categoria]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const payload = { categoria, descricao: descricao.trim(), valor: Number(valor), dataDespesa };
      if (despesa) {
        await api.patch(`/despesas/${despesa.id}`, payload);
      } else {
        await api.post(`/viagens/${viagemId}/despesas`, payload);
        setDescricao('');
        setValor('');
      }
      onSalvo();
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível salvar a despesa.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Select label="Categoria" required value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {opcoes.length === 0 && <option value="">Nenhuma categoria configurada</option>}
          {opcoes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input
          label="Data"
          type="date"
          required
          value={dataDespesa}
          onChange={(e) => setDataDespesa(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Input
            label="Descrição"
            required
            maxLength={200}
            value={descricao}
            onChange={(e) => {
              setDescricao(e.target.value);
              setErro('');
            }}
          />
        </div>
        <MoneyInput
          label="Valor (R$)"
          required
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setErro('');
          }}
        />
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={enviando || !categoria} className="flex-1">
          {despesa ? 'Salvar' : 'Lançar'}
        </Button>
        {onCancelar && (
          <Button type="button" variant="secondary" onClick={onCancelar}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
