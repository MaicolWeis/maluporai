import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { RoadStrip } from './RoadStrip';

interface Props {
  titulo: string;
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
}

export function Modal({ titulo, aberto, onFechar, children }: Props) {
  useEffect(() => {
    if (!aberto) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50" onClick={onFechar}>
      <div
        className="w-full max-w-md bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <RoadStrip />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">{titulo}</h2>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="text-zinc-400 hover:text-zinc-900"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
