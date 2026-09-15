import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { RoadStrip } from '../components/RoadStrip';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const { setSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/viagens';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/login', { email, senha });
      setSession(data.user, data.accessToken);
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.response?.status === 429) {
        setErro('Muitas tentativas. Tente novamente em alguns minutos.');
      } else {
        setErro(err.response?.data?.error?.message ?? 'Não foi possível entrar. Tente novamente.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <RoadStrip />
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <h1 className="text-2xl font-black">maluporai</h1>
            <p className="text-sm text-zinc-500">Gestão de viagens em grupo</p>
          </div>
          <Input
            label="E-mail"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Senha"
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          {erro && <p className="text-red-600 text-xs">{erro}</p>}
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </Button>
          <div className="flex justify-between text-xs">
            <Link to="/esqueci-senha" className="text-zinc-500 hover:text-zinc-900">
              Esqueci minha senha
            </Link>
            <Link to="/signup" className="font-semibold text-amber-600 hover:text-amber-700">
              Criar conta
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
