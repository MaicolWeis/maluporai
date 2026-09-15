import { Plus, X } from 'lucide-react';
import { useState } from 'react';

interface Props {
  label: string;
  valores: string[];
  onChange: (proximo: string[]) => void;
}

/** Lista de chips adicionáveis/removíveis — usada nas preferências (P4). */
export function ChipList({ label, valores, onChange }: Props) {
  const [novo, setNovo] = useState('');

  const adicionar = () => {
    const valor = novo.trim();
    if (!valor || valores.includes(valor)) return;
    onChange([...valores, valor]);
    setNovo('');
  };

  const remover = (valor: string) => {
    onChange(valores.filter((v) => v !== valor));
  };

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <div className="flex flex-wrap gap-2 mb-2">
        {valores.map((valor) => (
          <span
            key={valor}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-zinc-900 text-amber-400"
          >
            {valor}
            <button
              type="button"
              onClick={() => remover(valor)}
              aria-label={`Remover ${valor}`}
              className="hover:text-white"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {valores.length === 0 && <span className="text-xs text-zinc-400">Nenhuma opção cadastrada</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              adicionar();
            }
          }}
          placeholder="Adicionar…"
          className="flex-1 border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          type="button"
          onClick={adicionar}
          className="px-3 rounded-lg border border-stone-300 text-zinc-600 hover:border-amber-400 hover:text-zinc-900"
          aria-label="Adicionar"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
