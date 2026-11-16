import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface Props {
  titulo: ReactNode;
  acessorio?: ReactNode;
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
}

/** Painel lateral direito — usado para detalhe (ex.: cliente, viagem). */
export function Drawer({ titulo, acessorio, aberto, onFechar, children }: Props) {
  useEffect(() => {
    if (!aberto) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onFechar}>
      <div
        className="h-[100dvh] w-full max-w-lg bg-white shadow-pop border-l border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 flex-shrink-0 gap-3">
          <h2 className="text-base font-semibold text-slate-900 truncate">{titulo}</h2>
          <div className="flex items-center gap-3 flex-shrink-0">
            {acessorio}
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="text-zinc-400 hover:text-zinc-900"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
