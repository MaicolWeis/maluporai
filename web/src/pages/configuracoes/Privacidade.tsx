import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { api } from '../../lib/api';

export function Privacidade() {
  const [prazo, setPrazo] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get('/configuracoes').then(({ data }) => {
      setPrazo(data.configuracoes?.prazoRetencaoDadosMeses ?? 60);
    });
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prazo === null) return;
    setErro('');
    setMensagem('');
    if (prazo < 12) {
      setErro('O prazo mínimo de retenção é de 12 meses.');
      return;
    }
    setSalvando(true);
    try {
      await api.patch('/configuracoes/preferencias', { prazoRetencaoDadosMeses: prazo });
      setMensagem('Prazo de retenção salvo.');
    } catch (err: any) {
      setErro(err.response?.data?.error?.message ?? 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  if (prazo === null) return <p className="text-sm text-zinc-500">Carregando…</p>;

  return (
    <div className="max-w-lg space-y-6">
      <form onSubmit={salvar} className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <Input
          label="Prazo de retenção de dados (meses)"
          type="number"
          required
          // Sem `min` nativo de propósito: a validação HTML5 intercepta o
          // submit silenciosamente e mostra um balão do navegador em vez da
          // mensagem de erro consistente com o resto da tela — o mínimo de
          // 12 meses é checado abaixo, em salvar().
          value={prazo}
          onChange={(e) => setPrazo(Number(e.target.value))}
          error={erro}
        />
        <p className="text-xs text-zinc-500">
          Clientes sem nenhuma inscrição ativa há mais tempo do que esse prazo têm nome, CPF, telefone e e-mail
          anonimizados automaticamente. Os valores financeiros das inscrições passadas continuam preservados para a
          contabilidade do tenant. O mínimo permitido é 12 meses.
        </p>
        {mensagem && <p className="text-emerald-700 text-xs">{mensagem}</p>}
        <Button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>

      <Link to="/privacidade" className="text-sm font-semibold text-amber-600 hover:text-amber-700">
        Ver a Política de Privacidade da plataforma
      </Link>
    </div>
  );
}
