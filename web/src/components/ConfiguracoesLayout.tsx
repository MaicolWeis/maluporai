import { NavLink, Outlet } from 'react-router-dom';

const ABAS = [
  { to: 'empresa', label: 'Empresa' },
  { to: 'preferencias', label: 'Preferências' },
  { to: 'usuarios', label: 'Usuários' },
  { to: 'privacidade', label: 'Privacidade' },
];

export function ConfiguracoesLayout() {
  return (
    <div>
      <h1 className="text-2xl font-black mb-6">Configurações</h1>
      <div className="border-b border-stone-200 mb-6 flex gap-1">
        {ABAS.map((aba) => (
          <NavLink
            key={aba.to}
            to={aba.to}
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                isActive ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-900'
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
