import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/40" onClick={onFechar}>
      <div
        className="w-full max-w-md bg-white rounded-t-xl sm:rounded-xl shadow-pop border border-slate-200 overflow-hidden max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="text-zinc-400 hover:text-zinc-900"
            >
              <X size={18} />
            </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
