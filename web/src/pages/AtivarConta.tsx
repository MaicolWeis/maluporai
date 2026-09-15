import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { RoadStrip } from '../components/RoadStrip';
import { api } from '../lib/api';

export function AtivarConta() {
  const { token } = useParams<{ token: string }>();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) {
      setErro('Senha deve ter ao menos 8 caracteres');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      await api.post('/auth/ativar-conta', { token, senha });
      setSucesso(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err: any) {
      setErro(err.response?.data?.error?.message ?? 'Token inválido ou expirado.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <RoadStrip />
        <div className="p-6 space-y-4">
          <div>
            <h1 className="text-xl font-black">Ativar conta</h1>
            <p className="text-sm text-zinc-500">Defina sua senha para começar a usar o maluporai.</p>
          </div>
          {sucesso ? (
            <p className="text-sm text-emerald-700">Conta ativada com sucesso. Redirecionando para o login…</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Input
                label="Senha"
                type="password"
                autoComplete="new-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                error={erro}
              />
              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando ? 'Ativando…' : 'Ativar conta'}
              </Button>
            </form>
          )}
          <Link to="/login" className="block text-sm font-semibold text-amber-600 hover:text-amber-700">
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
