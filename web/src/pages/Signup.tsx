import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { RoadStrip } from '../components/RoadStrip';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface Erros {
  nomeFantasia?: string;
  documento?: string;
  nome?: string;
  email?: string;
  senha?: string;
  geral?: string;
}

export function Signup() {
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [documento, setDocumento] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);

  const { setSession } = useAuth();
  const navigate = useNavigate();

  const validarEtapa1 = () => {
    const next: Erros = {};
    if (nomeFantasia.trim().length < 2) next.nomeFantasia = 'Informe o nome da empresa';
    if (documento.replace(/\D/g, '').length < 11) next.documento = 'Documento inválido';
    setErros(next);
    return Object.keys(next).length === 0;
  };

  const validarEtapa2 = () => {
    const next: Erros = {};
    if (nome.trim().length < 2) next.nome = 'Informe seu nome';
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'E-mail inválido';
    if (senha.length < 8) next.senha = 'Senha deve ter ao menos 8 caracteres';
    setErros(next);
    return Object.keys(next).length === 0;
  };

  const avancar = () => {
    if (validarEtapa1()) setEtapa(2);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarEtapa2()) return;

    setEnviando(true);
    setErros({});
    try {
      const { data } = await api.post('/auth/signup', { nomeFantasia, documento, nome, email, senha });
      setSession(data.user, data.accessToken);
      navigate('/viagens', { replace: true });
    } catch (err: any) {
      const code = err.response?.data?.error?.code;
      if (code === 'EMAIL_EM_USO') {
        setErros({ email: 'Este e-mail já está cadastrado' });
      } else {
        setErros({ geral: err.response?.data?.error?.message ?? 'Não foi possível concluir o cadastro.' });
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
            <h1 className="text-xl font-black">Criar conta</h1>
            <p className="text-xs text-zinc-500">Etapa {etapa} de 2 — {etapa === 1 ? 'dados da empresa' : 'usuário administrador'}</p>
          </div>

          {etapa === 1 ? (
            <>
              <Input
                label="Nome fantasia"
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                error={erros.nomeFantasia}
              />
              <Input
                label="CNPJ ou CPF"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                error={erros.documento}
              />
              <Button type="button" className="w-full" onClick={avancar}>
                Continuar
              </Button>
            </>
          ) : (
            <>
              <Input label="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} error={erros.nome} />
              <Input
                label="E-mail"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={erros.email}
              />
              <Input
                label="Senha"
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                error={erros.senha}
              />
              {erros.geral && <p className="text-red-600 text-xs">{erros.geral}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setEtapa(1)}>
                  Voltar
                </Button>
                <Button type="submit" className="flex-1" disabled={enviando}>
                  {enviando ? 'Criando…' : 'Criar conta'}
                </Button>
              </div>
            </>
          )}

          <Link to="/login" className="block text-center text-sm font-semibold text-amber-600 hover:text-amber-700">
            Voltar para o login
          </Link>
        </form>
      </div>
    </div>
  );
}
