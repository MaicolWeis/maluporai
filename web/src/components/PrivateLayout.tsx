import { Bike, LogOut } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoadStrip } from './RoadStrip';

export function PrivateLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const sair = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-zinc-900 text-stone-100 flex flex-col">
        <div className="p-5">
          <div className="flex items-center gap-2 text-amber-400 font-black text-lg">
            <Bike size={20} /> maluporai
          </div>
          {user && <p className="text-xs text-stone-400 mt-1 truncate">{user.tenant.nomeFantasia}</p>}
        </div>
        <RoadStrip />
        <nav className="p-3 space-y-1 text-sm font-semibold flex-1">
          <NavLink
            to="/viagens"
            className={({ isActive }) =>
              `block px-3 py-2 rounded-md ${isActive ? 'bg-amber-400 text-zinc-900' : 'text-stone-300 hover:text-white'}`
            }
          >
            Viagens
          </NavLink>
          {user?.papel === 'admin' && (
            <NavLink
              to="/configuracoes/usuarios"
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md ${isActive ? 'bg-amber-400 text-zinc-900' : 'text-stone-300 hover:text-white'}`
              }
            >
              Usuários
            </NavLink>
          )}
        </nav>
        <div className="p-3 border-t border-zinc-800">
          {user && <p className="text-xs text-stone-400 truncate mb-2">{user.nome}</p>}
          <button
            onClick={sair}
            className="flex items-center gap-2 text-sm font-semibold text-stone-300 hover:text-white px-3 py-2 w-full rounded-md hover:bg-zinc-800"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
