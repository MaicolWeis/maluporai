import { Bike } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { RoadStrip } from './RoadStrip';

export function PrivateLayout() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-zinc-900 text-stone-100 flex flex-col">
        <div className="p-5">
          <div className="flex items-center gap-2 text-amber-400 font-black text-lg">
            <Bike size={20} /> maluporai
          </div>
        </div>
        <RoadStrip />
        <nav className="p-3 space-y-1 text-sm font-semibold">
          <NavLink
            to="/viagens"
            className={({ isActive }) =>
              `block px-3 py-2 rounded-md ${isActive ? 'bg-amber-400 text-zinc-900' : 'text-stone-300 hover:text-white'}`
            }
          >
            Viagens
          </NavLink>
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
