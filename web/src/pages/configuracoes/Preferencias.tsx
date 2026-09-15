import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { ChipList } from '../../components/ChipList';
import { Input } from '../../components/Input';
import { api } from '../../lib/api';

interface PreferenciasForm {
  logoUrl: string;
  corPrimaria: string;
  formasPagamento: string[];
  categoriasDespesa: string[];
  textoTermoInscricao: string;
}

const COR_PADRAO = '#18181b';

export function Preferencias() {
  const [form, setForm] = useState<PreferenciasForm | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get('/configuracoes').then(({ data }) => {
      const c = data.configuracoes;
      setForm({
        logoUrl: c?.logoUrl ?? '',
        corPrimaria: c?.corPrimaria ?? COR_PADRAO,
        formasPagamento: c?.formasPagamento ?? [],
        categoriasDespesa: c?.categoriasDespesa ?? [],
        textoTermoInscricao: c?.textoTermoInscricao ?? '',
      });
    });
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSalvando(true);
    setErro('');
    setMensagem('');
    try {
      await api.patch('/configuracoes/preferencias', {
        logoUrl: form.logoUrl || null,
        corPrimaria: form.corPrimaria || null,
        formasPagamento: form.formasPagamento,
        categoriasDespesa: form.categoriasDespesa,
        textoTermoInscricao: form.textoTermoInscricao || null,
      });
      setMensagem('Preferências salvas.');
    } catch (err: any) {
      setErro(err.response?.data?.error?.message ?? 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  if (!form) return <p className="text-sm text-zinc-500">Carregando…</p>;

  return (
    <form onSubmit={salvar} className="max-w-lg space-y-6">
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <Input label="URL do logo" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />

        <div>
          <p className="text-xs text-zinc-500 mb-1">Cor primária</p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.corPrimaria}
              onChange={(e) => setForm({ ...form, corPrimaria: e.target.value })}
              className="h-9 w-14 rounded border border-stone-300 cursor-pointer"
            />
            <div
              className="flex-1 rounded-lg px-4 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: form.corPrimaria || COR_PADRAO }}
            >
              Prévia da cor primária aplicada
            </div>
          </div>
        </div>

        <ChipList
          label="Formas de pagamento"
          valores={form.formasPagamento}
          onChange={(v) => setForm({ ...form, formasPagamento: v })}
        />
        <ChipList
          label="Categorias de despesa"
          valores={form.categoriasDespesa}
          onChange={(v) => setForm({ ...form, categoriasDespesa: v })}
        />

        <label className="block text-xs text-zinc-500">
          Texto do termo de inscrição
          <textarea
            value={form.textoTermoInscricao}
            onChange={(e) => setForm({ ...form, textoTermoInscricao: e.target.value })}
            rows={4}
            className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>
      </div>

      {erro && <p className="text-red-600 text-xs">{erro}</p>}
      {mensagem && <p className="text-emerald-700 text-xs">{mensagem}</p>}
      <Button type="submit" disabled={salvando}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  );
}
