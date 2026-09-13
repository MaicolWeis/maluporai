import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { RoadStrip } from '../components/RoadStrip';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const submit = () => {
    // P2: integração com POST /auth/login
    alert('Autenticação será implementada no P2.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <RoadStrip />
        <div className="p-6 space-y-4">
          <div>
            <h1 className="text-2xl font-black">maluporai</h1>
            <p className="text-sm text-zinc-500">Gestão de viagens em grupo</p>
          </div>
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <Button className="w-full" onClick={submit}>Entrar</Button>
          <div className="flex justify-between text-xs">
            <Link to="/esqueci-senha" className="text-zinc-500 hover:text-zinc-900">Esqueci minha senha</Link>
            <Link to="/signup" className="font-semibold text-amber-600 hover:text-amber-700">Criar conta</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
