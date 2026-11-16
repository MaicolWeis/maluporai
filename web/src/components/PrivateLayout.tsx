import { Bike, Gauge, LogOut, Map, PanelLeft, Settings, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DicaInstalar } from './DicaInstalar';

const ITENS = [
  { to: '/dashboard', label: 'Visão geral', icone: Gauge },
  { to: '/viagens', label: 'Viagens', icone: Map },
  { to: '/clientes', label: 'Clientes', icone: Users },
];

const ROTULOS: Record<string, string> = {
  dashboard: 'Visão geral',
  viagens: 'Viagens',
  clientes: 'Clientes',
  configuracoes: 'Configurações',
  empresa: 'Empresa',
  preferencias: 'Preferências',
  usuarios: 'Usuários',
  privacidade: 'Privacidade',
  auditoria: 'Auditoria',
};

function iniciais(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

/**
 * Layout autenticado no padrão NSDS (TMS LTL): header branco de 44px com
 * marca + breadcrumb, sidebar clara recolhível e rodapé com versão.
 */
export function PrivateLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [recolhido, setRecolhido] = useState(false);

  const sair = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const trilha = pathname.split('/').filter(Boolean).map((seg) => ROTULOS[seg] ?? seg);
  const itens = user?.papel === 'admin' ? [...ITENS, { to: '/configuracoes', label: 'Configurações', icone: Settings }] : ITENS;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="h-11 bg-white border-b border-slate-200 flex items-center gap-3 px-4 sticky top-0 z-40 flex-shrink-0 pt-[env(safe-area-inset-top)] box-content">
        <button
          type="button"
          onClick={() => setRecolhido((v) => !v)}
          aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
          className="hidden md:flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        >
          <PanelLeft size={16} />
        </button>
        <Link to="/dashboard" className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-brand">
          <Bike size={17} /> maluporai
        </Link>
        <nav aria-label="Trilha" className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500 min-w-0">
          {user && <span className="truncate">{user.tenant.nomeFantasia}</span>}
          {trilha.map((t, i) => (
            <span key={`${t}-${i}`} className="flex items-center gap-2 min-w-0">
              <span className="text-slate-300">/</span>
              <span className={`truncate ${i === trilha.length - 1 ? 'text-slate-900' : ''}`}>{t}</span>
            </span>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <span
              title={user.nome}
              className="h-7 w-7 rounded-full bg-brand-soft text-brand-ink border border-brand-border text-[11px] font-semibold flex items-center justify-center"
            >
              {iniciais(user.nome)}
            </span>
          )}
          <button
            type="button"
            onClick={sair}
            title="Sair"
            className="h-7 px-2 flex items-center gap-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <LogOut size={14} /> <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside
          className={`hidden md:block ${recolhido ? 'w-14' : 'w-52'} bg-white border-r border-slate-200 flex-shrink-0 transition-[width] duration-150`}
        >
          <nav className="p-2 space-y-0.5 sticky top-11">
            {itens.map(({ to, label, icone: Icone }) => (
              <NavLink
                key={to}
                to={to}
                title={recolhido ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 h-9 px-3 rounded-md text-sm font-medium transition-colors ${
                    isActive ? 'bg-brand-soft text-brand-ink' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icone size={16} className="flex-shrink-0" />
                {!recolhido && <span className="truncate">{label}</span>}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 md:px-6 pt-4 pb-24 md:pb-6">
            <DicaInstalar />
            <Outlet />
          </main>
          <footer className="hidden md:flex bg-white border-t border-slate-200 px-6 py-3 flex-wrap gap-4 text-xs text-slate-500">
            <span>maluporai</span>
            <span>Versão 0.11</span>
            <Link to="/privacidade" target="_blank" className="hover:text-brand">
              Privacidade
            </Link>
          </footer>
        </div>
      </div>

      {/* Celular: navegação inferior fixa (padrão de app), com área segura do iPhone. */}
      <nav
        aria-label="Navegação principal"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 grid pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${itens.length}, minmax(0, 1fr))` }}
      >
        {itens.map(({ to, label, icone: Icone }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] font-medium ${
                isActive ? 'text-brand' : 'text-slate-500'
              }`
            }
          >
            <Icone size={20} />
            <span className="truncate max-w-full px-1">{label === 'Configurações' ? 'Ajustes' : label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
