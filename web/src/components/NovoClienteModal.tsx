import { useState } from 'react';
import { api } from '../lib/api';
import { Button } from './Button';
import { CamposLocalidade } from './CamposLocalidade';
import { CamposMoto } from './CamposMoto';
import { hojeLocalISO } from '../lib/format';
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
  const [pais, setPais] = useState('BR');
  const [dataNascimento, setDataNascimento] = useState('');
  const [motoMarca, setMotoMarca] = useState('');
  const [motoModelo, setMotoModelo] = useState('');
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
    setPais('BR');
    setDataNascimento('');
    setMotoMarca('');
    setMotoModelo('');
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
        pais,
        dataNascimento: dataNascimento || undefined,
        motoMarca: motoMarca.trim() || undefined,
        motoModelo: motoModelo.trim() || undefined,
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
        <Input label="Telefone" type="tel" required value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        <Input label="CPF (opcional)" inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} />
        <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <CamposLocalidade
          valor={{ pais, cidade, estado: uf }}
          onChange={(l) => {
            setPais(l.pais);
            setCidade(l.cidade);
            setUf(l.estado);
          }}
        />
        <Input
          label="Data de nascimento"
          type="date"
          min="1900-01-01"
          max={hojeLocalISO()}
          value={dataNascimento}
          onChange={(e) => setDataNascimento(e.target.value)}
        />
        <CamposMoto
          marca={motoMarca}
          modelo={motoModelo}
          onChange={({ marca, modelo }) => {
            setMotoMarca(marca);
            setMotoModelo(modelo);
          }}
        />
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
