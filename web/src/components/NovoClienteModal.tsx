import { useState } from 'react';
import { api } from '../lib/api';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';

interface ClienteCriado {
  id: string;
  nome: string;
  telefone: string;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onCriado: (cliente: ClienteCriado) => void;
}

export function NovoClienteModal({ aberto, onFechar, onCriado }: Props) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [consentimentoMarketing, setConsentimentoMarketing] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const limpar = () => {
    setNome('');
    setTelefone('');
    setCpf('');
    setEmail('');
    setCidade('');
    setUf('');
    setConsentimentoMarketing(false);
    setErro('');
  };

  const fechar = () => {
    limpar();
    onFechar();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const { data } = await api.post('/clientes', {
        nome,
        telefone,
        cpf: cpf.trim() || undefined,
        email: email.trim() || undefined,
        cidade: cidade.trim() || undefined,
        uf: uf.trim() || undefined,
        consentimentoMarketing,
      });
      onCriado(data.cliente);
      fechar();
    } catch (err: any) {
      setErro(err.response?.data?.error?.message ?? 'Não foi possível criar o cliente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Novo cliente" aberto={aberto} onFechar={fechar}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input label="Telefone" required value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        <Input label="CPF (opcional)" value={cpf} onChange={(e) => setCpf(e.target.value)} />
        <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex gap-2">
          <div className="flex-1">
            <Input label="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
          </div>
          <div className="w-20">
            <Input label="UF" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} />
          </div>
        </div>
        <label className="flex items-start gap-2 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={consentimentoMarketing}
            onChange={(e) => setConsentimentoMarketing(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Aceita receber comunicações de marketing (promoções, novidades de viagens). Desmarcado por padrão — o
            cliente pode mudar de ideia a qualquer momento.
          </span>
        </label>
        {erro && <p className="text-red-600 text-xs">{erro}</p>}
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? 'Criando…' : 'Criar cliente'}
        </Button>
      </form>
    </Modal>
  );
}
