import { Link } from 'react-router-dom';
import { RoadStrip } from '../components/RoadStrip';

export function EsqueciSenha() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <RoadStrip />
        <div className="p-6 space-y-3">
          <h1 className="text-xl font-black">Recuperar senha</h1>
          <p className="text-sm text-zinc-500">Fluxo de recuperação será implementado no P2.</p>
          <Link to="/login" className="text-sm font-semibold text-amber-600 hover:text-amber-700">
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
