import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { api } from '../lib/api';

export function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/esqueci-senha', { email });
      // Resposta é sempre a mesma, exista ou não o e-mail — não há erro
      // "e-mail não encontrado" a tratar aqui de propósito.
      setMensagem(data.message);
    } catch {
      setMensagem('Se o e-mail existir em nossa base, enviaremos as instruções de redefinição.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-6 space-y-4">
          <h1 className="text-xl font-semibold">Recuperar senha</h1>
          {mensagem ? (
            <p className="text-sm text-zinc-600">{mensagem}</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-zinc-500">
                Informe seu e-mail. Se houver uma conta associada, enviaremos um link de redefinição.
              </p>
              <Input
                label="E-mail"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar instruções'}
              </Button>
            </form>
          )}
          <Link to="/login" className="block text-sm font-semibold text-brand hover:text-brand-hover">
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
