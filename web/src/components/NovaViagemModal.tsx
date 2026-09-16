import { useState } from 'react';
import { api } from '../lib/api';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onCriada: () => void;
}

const FORM_INICIAL = {
  nome: '',
  destinoCidade: '',
  destinoUf: '',
  dataInicio: '',
  dataFim: '',
  capacidade: '',
  precoTitular: '',
  precoAcompanhante: '',
};

export function NovaViagemModal({ aberto, onFechar, onCriada }: Props) {
  const [form, setForm] = useState(FORM_INICIAL);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const fechar = () => {
    setForm(FORM_INICIAL);
    setErro('');
    onFechar();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await api.post('/viagens', {
        nome: form.nome,
        destinoCidade: form.destinoCidade,
        destinoUf: form.destinoUf,
        dataInicio: form.dataInicio,
        dataFim: form.dataFim,
        capacidade: Number(form.capacidade),
        precoTitular: Number(form.precoTitular),
        precoAcompanhante: form.precoAcompanhante ? Number(form.precoAcompanhante) : undefined,
      });
      onCriada();
      fechar();
    } catch (err: any) {
      setErro(err.response?.data?.error?.message ?? 'Não foi possível criar a viagem.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Nova viagem" aberto={aberto} onFechar={fechar}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              label="Destino (cidade)"
              required
              value={form.destinoCidade}
              onChange={(e) => setForm({ ...form, destinoCidade: e.target.value })}
            />
          </div>
          <div className="w-20">
            <Input
              label="UF"
              required
              maxLength={2}
              value={form.destinoUf}
              onChange={(e) => setForm({ ...form, destinoUf: e.target.value.toUpperCase() })}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              label="Data início"
              type="date"
              required
              value={form.dataInicio}
              onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <Input
              label="Data fim"
              type="date"
              required
              value={form.dataFim}
              onChange={(e) => setForm({ ...form, dataFim: e.target.value })}
            />
          </div>
        </div>
        <Input
          label="Capacidade"
          type="number"
          min={1}
          required
          value={form.capacidade}
          onChange={(e) => setForm({ ...form, capacidade: e.target.value })}
        />
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              label="Preço titular (R$)"
              type="number"
              min={0}
              step="0.01"
              required
              value={form.precoTitular}
              onChange={(e) => setForm({ ...form, precoTitular: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <Input
              label="Preço acompanhante (R$)"
              type="number"
              min={0}
              step="0.01"
              value={form.precoAcompanhante}
              onChange={(e) => setForm({ ...form, precoAcompanhante: e.target.value })}
            />
          </div>
        </div>
        {erro && <p className="text-red-600 text-xs">{erro}</p>}
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? 'Criando…' : 'Criar viagem'}
        </Button>
      </form>
    </Modal>
  );
}
