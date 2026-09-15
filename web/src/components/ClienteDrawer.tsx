import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { ClienteDetalhe, InscricaoResumo } from '../types/cliente';
import { Button } from './Button';
import { Drawer } from './Drawer';
import { EmptyState } from './EmptyState';
import { Input } from './Input';
import { Modal } from './Modal';
import { Pill } from './Pill';

type Aba = 'dados' | 'viagens' | 'privacidade';

const ABAS: { id: Aba; label: string }[] = [
  { id: 'dados', label: 'Dados' },
  { id: 'viagens', label: 'Viagens' },
  { id: 'privacidade', label: 'Privacidade' },
];

interface Props {
  clienteId: string | null;
  onFechar: () => void;
  onAtualizado: () => void;
}

export function ClienteDrawer({ clienteId, onFechar, onAtualizado }: Props) {
  const { user } = useAuth();
  const [aba, setAba] = useState<Aba>('dados');
  const [cliente, setCliente] = useState<ClienteDetalhe | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = async (id: string) => {
    setCarregando(true);
    try {
      const { data } = await api.get(`/clientes/${id}`);
      setCliente(data.cliente);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!clienteId) {
      setCliente(null);
      return;
    }
    setAba('dados');
    carregar(clienteId);
  }, [clienteId]);

  const recarregar = async () => {
    if (!clienteId) return;
    await carregar(clienteId);
    onAtualizado();
  };

  return (
    <Drawer titulo={cliente?.nome ?? 'Cliente'} aberto={!!clienteId} onFechar={onFechar}>
      {carregando || !cliente ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : (
        <div>
          <div className="flex gap-1 border-b border-stone-200 mb-6">
            {ABAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  aba === a.id ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          {aba === 'dados' && <AbaDados cliente={cliente} clienteId={clienteId!} onSalvo={recarregar} />}
          {aba === 'viagens' && <AbaViagens inscricoes={cliente.inscricoes} />}
          {aba === 'privacidade' && (
            <AbaPrivacidade
              cliente={cliente}
              clienteId={clienteId!}
              isAdmin={user?.papel === 'admin'}
              onAnonimizado={recarregar}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Aba Dados
// ---------------------------------------------------------------------------

function AbaDados({
  cliente,
  clienteId,
  onSalvo,
}: {
  cliente: ClienteDetalhe;
  clienteId: string;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState({
    nome: cliente.nome,
    telefone: cliente.telefone,
    email: cliente.email ?? '',
    cidade: cliente.cidade ?? '',
    uf: cliente.uf ?? '',
    dataNascimento: cliente.dataNascimento?.slice(0, 10) ?? '',
    contatoEmergenciaNome: cliente.contatoEmergenciaNome ?? '',
    contatoEmergenciaTelefone: cliente.contatoEmergenciaTelefone ?? '',
    observacoes: cliente.observacoes ?? '',
    consentimentoMarketing: cliente.consentimentoMarketing,
    cpf: '',
  });
  const [cpfRevelado, setCpfRevelado] = useState<string | null>(null);
  const [revelando, setRevelando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const revelarCpf = async () => {
    setRevelando(true);
    setErro('');
    try {
      const { data } = await api.get(`/clientes/${clienteId}/cpf`);
      setCpfRevelado(data.cpf);
    } catch (err: any) {
      setErro(err.response?.data?.error?.message ?? 'Não foi possível revelar o CPF.');
    } finally {
      setRevelando(false);
    }
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setSalvando(true);
    try {
      const payload: Record<string, unknown> = {
        nome: form.nome,
        telefone: form.telefone,
        email: form.email.trim() || undefined,
        cidade: form.cidade.trim() || undefined,
        uf: form.uf.trim() || undefined,
        dataNascimento: form.dataNascimento || undefined,
        contatoEmergenciaNome: form.contatoEmergenciaNome.trim() || undefined,
        contatoEmergenciaTelefone: form.contatoEmergenciaTelefone.trim() || undefined,
        observacoes: form.observacoes.trim() || undefined,
        consentimentoMarketing: form.consentimentoMarketing,
      };
      if (form.cpf.trim()) payload.cpf = form.cpf.trim();

      await api.patch(`/clientes/${clienteId}`, payload);
      setMensagem('Dados salvos.');
      setForm((f) => ({ ...f, cpf: '' }));
      setCpfRevelado(null);
      onSalvo();
    } catch (err: any) {
      setErro(err.response?.data?.error?.message ?? 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  if (cliente.anonimizadoEm) {
    return <p className="text-sm text-zinc-500">Cliente anonimizado — os dados de identificação não existem mais.</p>;
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Input label="Nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
      <Input
        label="Telefone"
        required
        value={form.telefone}
        onChange={(e) => setForm({ ...form, telefone: e.target.value })}
      />

      <div>
        <p className="text-xs text-zinc-500 mb-1">CPF</p>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-mono text-zinc-700">{cpfRevelado ?? cliente.cpfMascarado ?? 'Não cadastrado'}</span>
          {cliente.cpfMascarado && !cpfRevelado && (
            <button
              type="button"
              onClick={revelarCpf}
              disabled={revelando}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 disabled:opacity-50"
            >
              {revelando ? 'Revelando…' : 'Revelar'}
            </button>
          )}
        </div>
        <Input
          label="Substituir CPF (opcional)"
          placeholder="Deixe em branco para manter"
          value={form.cpf}
          onChange={(e) => setForm({ ...form, cpf: e.target.value })}
        />
      </div>

      <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <div className="flex gap-2">
        <div className="flex-1">
          <Input label="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
        </div>
        <div className="w-20">
          <Input
            label="UF"
            maxLength={2}
            value={form.uf}
            onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
          />
        </div>
      </div>
      <Input
        label="Data de nascimento"
        type="date"
        value={form.dataNascimento}
        onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })}
      />
      <Input
        label="Contato de emergência — nome"
        value={form.contatoEmergenciaNome}
        onChange={(e) => setForm({ ...form, contatoEmergenciaNome: e.target.value })}
      />
      <Input
        label="Contato de emergência — telefone"
        value={form.contatoEmergenciaTelefone}
        onChange={(e) => setForm({ ...form, contatoEmergenciaTelefone: e.target.value })}
      />
      <label className="block text-xs text-zinc-500">
        Observações
        <textarea
          value={form.observacoes}
          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          rows={3}
          className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </label>
      <label className="flex items-start gap-2 text-xs text-zinc-600">
        <input
          type="checkbox"
          checked={form.consentimentoMarketing}
          onChange={(e) => setForm({ ...form, consentimentoMarketing: e.target.checked })}
          className="mt-0.5"
        />
        <span>Aceita receber comunicações de marketing.</span>
      </label>

      {erro && <p className="text-red-600 text-xs">{erro}</p>}
      {mensagem && <p className="text-emerald-700 text-xs">{mensagem}</p>}
      <Button type="submit" disabled={salvando}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Aba Viagens
// ---------------------------------------------------------------------------

const STATUS_PAGAMENTO_PILL: Record<InscricaoResumo['statusPagamento'], string> = {
  pago: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  parcial: 'bg-amber-100 text-amber-700 border border-amber-200',
  pendente: 'bg-red-100 text-red-700 border border-red-200',
};

function AbaViagens({ inscricoes }: { inscricoes: InscricaoResumo[] }) {
  if (inscricoes.length === 0) {
    return (
      <EmptyState
        titulo="Nenhuma inscrição ainda"
        descricao="As viagens desse cliente aparecem aqui assim que ele se inscrever."
      />
    );
  }

  return (
    <div className="space-y-3">
      {inscricoes.map((i) => (
        <div key={i.id} className="border border-stone-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-sm text-zinc-900">{i.viagem.nome}</p>
            <Pill cls={STATUS_PAGAMENTO_PILL[i.statusPagamento]}>{i.statusPagamento}</Pill>
          </div>
          <p className="text-xs text-zinc-500">
            {i.viagem.destinoCidade}/{i.viagem.destinoUf}
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            R$ {Number(i.valorPago).toFixed(2)} de R$ {Number(i.valorTotal).toFixed(2)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba Privacidade
// ---------------------------------------------------------------------------

function AbaPrivacidade({
  cliente,
  clienteId,
  isAdmin,
  onAnonimizado,
}: {
  cliente: ClienteDetalhe;
  clienteId: string;
  isAdmin: boolean;
  onAnonimizado: () => void;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erroExport, setErroExport] = useState('');

  const exportar = async () => {
    setExportando(true);
    setErroExport('');
    try {
      const { data } = await api.get(`/clientes/${clienteId}/exportar`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      setErroExport(err.response?.data?.error?.message ?? 'Não foi possível exportar os dados.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-zinc-500 mb-1">Consentimento de marketing</p>
        <Pill
          cls={
            cliente.consentimentoMarketing
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              : 'bg-stone-100 text-zinc-600 border border-stone-200'
          }
        >
          {cliente.consentimentoMarketing && cliente.consentimentoEm
            ? `Aceito em ${new Date(cliente.consentimentoEm).toLocaleDateString('pt-BR')}`
            : 'Não aceito'}
        </Pill>
      </div>

      {cliente.anonimizadoEm ? (
        <p className="text-sm text-zinc-500">
          Cliente anonimizado em {new Date(cliente.anonimizadoEm).toLocaleDateString('pt-BR')}. Os dados de
          identificação foram substituídos permanentemente; inscrições e valores financeiros continuam preservados.
        </p>
      ) : isAdmin ? (
        <div className="space-y-3">
          <Button variant="secondary" onClick={exportar} disabled={exportando} className="w-full">
            {exportando ? 'Exportando…' : 'Exportar dados (LGPD)'}
          </Button>
          {erroExport && <p className="text-red-600 text-xs">{erroExport}</p>}
          <Button variant="danger" onClick={() => setModalAberto(true)} className="w-full">
            Anonimizar cliente
          </Button>
        </div>
      ) : (
        <p className="text-xs text-zinc-400">Exportação e anonimização são restritas a administradores.</p>
      )}

      <AnonimizarModal
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        clienteId={clienteId}
        nomeCliente={cliente.nome}
        onAnonimizado={onAnonimizado}
      />
    </div>
  );
}

function AnonimizarModal({
  aberto,
  onFechar,
  clienteId,
  nomeCliente,
  onAnonimizado,
}: {
  aberto: boolean;
  onFechar: () => void;
  clienteId: string;
  nomeCliente: string;
  onAnonimizado: () => void;
}) {
  const [confirmacaoNome, setConfirmacaoNome] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setConfirmacaoNome('');
      setSenha('');
      setErro('');
    }
  }, [aberto]);

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await api.post(`/clientes/${clienteId}/anonimizar`, { confirmacaoNome, senhaConfirmacao: senha });
      onAnonimizado();
      onFechar();
    } catch (err: any) {
      setErro(err.response?.data?.error?.message ?? 'Não foi possível anonimizar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Anonimizar cliente" aberto={aberto} onFechar={onFechar}>
      <form onSubmit={confirmar} className="space-y-4">
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          Essa ação é <strong>irreversível</strong>. Nome, CPF, telefone, e-mail e contatos de emergência serão
          substituídos permanentemente. Inscrições e valores financeiros são preservados para a contabilidade.
        </p>
        <Input
          label={`Digite "${nomeCliente}" para confirmar`}
          required
          value={confirmacaoNome}
          onChange={(e) => setConfirmacaoNome(e.target.value)}
        />
        <Input label="Sua senha" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        {erro && <p className="text-red-600 text-xs">{erro}</p>}
        <Button
          type="submit"
          variant="danger"
          className="w-full"
          disabled={enviando || confirmacaoNome !== nomeCliente}
        >
          {enviando ? 'Anonimizando…' : 'Confirmar anonimização'}
        </Button>
      </form>
    </Modal>
  );
}
