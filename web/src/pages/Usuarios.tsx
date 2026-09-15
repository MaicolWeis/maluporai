import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { Pill } from '../components/Pill';
import { Select } from '../components/Select';
import { EmptyState } from '../components/EmptyState';
import { api } from '../lib/api';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: 'admin' | 'operador';
  status: 'ativo' | 'inativo' | 'convidado';
  ultimoLoginAt: string | null;
}

const PAPEL_LABEL: Record<Usuario['papel'], string> = { admin: 'Admin', operador: 'Operador' };

const STATUS_PILL: Record<Usuario['status'], { label: string; cls: string }> = {
  ativo: { label: 'Ativo', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  inativo: { label: 'Inativo', cls: 'bg-red-100 text-red-700 border border-red-200' },
  convidado: { label: 'Convidado', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
};

export function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<Usuario['papel']>('operador');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [acaoEmAndamentoId, setAcaoEmAndamentoId] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/usuarios');
      setUsuarios(data.usuarios);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrirModal = () => {
    setNome('');
    setEmail('');
    setPapel('operador');
    setErro('');
    setModalAberto(true);
  };

  const convidar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await api.post('/usuarios/convites', { nome, email, papel });
      setModalAberto(false);
      await carregar();
    } catch (err: any) {
      setErro(err.response?.data?.error?.message ?? 'Não foi possível enviar o convite.');
    } finally {
      setEnviando(false);
    }
  };

  const alternarStatus = async (usuario: Usuario) => {
    const vaiInativar = usuario.status !== 'inativo';
    const mensagem = vaiInativar
      ? `Inativar ${usuario.nome}? A pessoa perde o acesso imediatamente.`
      : `Reativar ${usuario.nome}?`;
    if (!window.confirm(mensagem)) return;

    setAcaoEmAndamentoId(usuario.id);
    try {
      await api.patch(`/usuarios/${usuario.id}`, { status: vaiInativar ? 'inativo' : 'ativo' });
      await carregar();
    } catch (err: any) {
      alert(err.response?.data?.error?.message ?? 'Não foi possível alterar o status.');
    } finally {
      setAcaoEmAndamentoId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-end mb-6">
        <Button onClick={abrirModal}>Convidar usuário</Button>
      </div>

      {carregando ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : usuarios.length === 0 ? (
        <EmptyState titulo="Nenhum usuário ainda" descricao="Convide alguém pra começar." />
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold">E-mail</th>
                <th className="px-4 py-3 font-semibold">Papel</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Último login</th>
                <th className="px-4 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-semibold text-zinc-900">{u.nome}</td>
                  <td className="px-4 py-3 text-zinc-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <Pill>{PAPEL_LABEL[u.papel]}</Pill>
                  </td>
                  <td className="px-4 py-3">
                    <Pill cls={STATUS_PILL[u.status].cls}>{STATUS_PILL[u.status].label}</Pill>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {u.ultimoLoginAt ? new Date(u.ultimoLoginAt).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.status !== 'convidado' && (
                      <button
                        onClick={() => alternarStatus(u)}
                        disabled={acaoEmAndamentoId === u.id}
                        className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
                      >
                        {u.status === 'inativo' ? 'Reativar' : 'Inativar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal titulo="Convidar usuário" aberto={modalAberto} onFechar={() => setModalAberto(false)}>
        <form onSubmit={convidar} className="space-y-4">
          <Input label="Nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input
            label="E-mail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Select label="Papel" value={papel} onChange={(e) => setPapel(e.target.value as Usuario['papel'])}>
            <option value="operador">Operador</option>
            <option value="admin">Admin</option>
          </Select>
          {erro && <p className="text-red-600 text-xs">{erro}</p>}
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar convite'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
