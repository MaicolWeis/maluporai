import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { api } from '../../lib/api';

interface EmpresaForm {
  nomeFantasia: string;
  razaoSocial: string;
  documento: string;
  emailContato: string;
  telefone: string;
}

export function Empresa() {
  const [form, setForm] = useState<EmpresaForm | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get('/configuracoes').then(({ data }) => {
      setForm({
        nomeFantasia: data.tenant.nomeFantasia ?? '',
        razaoSocial: data.tenant.razaoSocial ?? '',
        documento: data.tenant.documento ?? '',
        emailContato: data.tenant.emailContato ?? '',
        telefone: data.tenant.telefone ?? '',
      });
    });
  }, []);

  const campo = (chave: keyof EmpresaForm) => ({
    value: form?.[chave] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => (f ? { ...f, [chave]: e.target.value } : f)),
  });

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSalvando(true);
    setErro('');
    setMensagem('');
    try {
      await api.patch('/configuracoes/empresa', {
        nomeFantasia: form.nomeFantasia,
        razaoSocial: form.razaoSocial || null,
        documento: form.documento,
        emailContato: form.emailContato,
        telefone: form.telefone || null,
      });
      setMensagem('Dados da empresa salvos.');
    } catch (err: any) {
      setErro(err.response?.data?.error?.message ?? 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  if (!form) return <p className="text-sm text-zinc-500">Carregando…</p>;

  return (
    <form onSubmit={salvar} className="max-w-lg space-y-4 bg-white rounded-xl border border-stone-200 p-6">
      <Input label="Nome fantasia" required {...campo('nomeFantasia')} />
      <Input label="Razão social" {...campo('razaoSocial')} />
      <Input label="CNPJ/CPF" required {...campo('documento')} />
      <Input label="E-mail de contato" type="email" required {...campo('emailContato')} />
      <Input label="Telefone" {...campo('telefone')} />
      {erro && <p className="text-red-600 text-xs">{erro}</p>}
      {mensagem && <p className="text-emerald-700 text-xs">{mensagem}</p>}
      <Button type="submit" disabled={salvando}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  );
}
