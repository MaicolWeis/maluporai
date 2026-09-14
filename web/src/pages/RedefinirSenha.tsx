import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { RoadStrip } from '../components/RoadStrip';
import { api } from '../lib/api';

export function RedefinirSenha() {
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
      await api.post('/auth/redefinir-senha', { token, senha });
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
          <h1 className="text-xl font-black">Redefinir senha</h1>
          {sucesso ? (
            <p className="text-sm text-emerald-700">Senha redefinida com sucesso. Redirecionando para o login…</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Input
                label="Nova senha"
                type="password"
                autoComplete="new-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                error={erro}
              />
              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando ? 'Salvando…' : 'Redefinir senha'}
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
