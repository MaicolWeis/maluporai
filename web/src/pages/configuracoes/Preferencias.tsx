import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { ChipList } from '../../components/ChipList';
import { FileUpload } from '../../components/FileUpload';
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

  // Prévia do logo via URL assinada (bucket privado); só referências nossas.
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  useEffect(() => {
    const ref = form?.logoUrl;
    if (!ref || !ref.startsWith('logos/')) return setLogoPreview(null);
    api
      .get('/uploads/signed-url', { params: { path: ref } })
      .then(({ data }) => setLogoPreview(data.url))
      .catch(() => setLogoPreview(null));
  }, [form?.logoUrl]);

  if (!form) return <p className="text-sm text-zinc-500">Carregando…</p>;

  return (
    <form onSubmit={salvar} className="max-w-lg space-y-6">
      <div className="bg-white rounded-xl border border-stone-200 shadow-card p-6 space-y-4">
        <div>
          <p className="text-xs text-zinc-500 mb-1">Logo</p>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-lg border border-stone-200 bg-stone-50 flex items-center justify-center overflow-hidden flex-shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo atual" className="h-full w-full object-contain" />
              ) : (
                <span className="text-[10px] text-zinc-400">sem logo</span>
              )}
            </div>
            <div className="flex-1">
              <FileUpload
                finalidade="logo"
                aceitaPdf={false}
                rotulo="Arraste o logo ou clique"
                onEnviado={(ref) => setForm({ ...form, logoUrl: ref })}
              />
            </div>
          </div>
        </div>

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
            className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
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
