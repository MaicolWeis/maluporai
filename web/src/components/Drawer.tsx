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

/** Painel lateral direito — usado para detalhe (ex.: cliente, viagem). */
export function Drawer({ titulo, aberto, onFechar, children }: Props) {
  useEffect(() => {
    if (!aberto) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-zinc-900/50" onClick={onFechar}>
      <div
        className="h-full w-full max-w-lg bg-white shadow-lg border-l border-stone-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <RoadStrip />
        <div className="p-5 flex items-center justify-between border-b border-stone-100 flex-shrink-0">
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
        <div className="p-6 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
