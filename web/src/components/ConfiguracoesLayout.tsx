import { NavLink, Outlet } from 'react-router-dom';

const ABAS = [
  { to: 'empresa', label: 'Empresa' },
  { to: 'preferencias', label: 'Preferências' },
  { to: 'usuarios', label: 'Usuários' },
  { to: 'privacidade', label: 'Privacidade' },
  { to: 'auditoria', label: 'Auditoria' },
];

export function ConfiguracoesLayout() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-base font-semibold text-slate-900">Configurações</h1>
        <p className="text-xs text-slate-500">Empresa, preferências, usuários, privacidade e auditoria</p>
      </div>
      <div className="border-b border-slate-200 mb-4 flex gap-1 overflow-x-auto">
        {ABAS.map((aba) => (
          <NavLink
            key={aba.to}
            to={aba.to}
            className={({ isActive }) =>
              `px-3 h-9 inline-flex items-center text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                isActive ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-900'
              }`
            }
          >
            {aba.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
