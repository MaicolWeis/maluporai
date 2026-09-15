import type { SelectHTMLAttributes } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export function Select({ label, error, className = '', children, ...props }: Props) {
  return (
    <label className="block text-xs text-zinc-500">
      {label}
      <select
        className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 ${error ? 'border-red-400' : 'border-stone-300'} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-red-600 text-xs mt-0.5 block">{error}</span>}
    </label>
  );
}
