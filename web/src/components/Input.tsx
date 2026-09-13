import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: Props) {
  return (
    <label className="block text-xs text-zinc-500">
      {label}
      <input
        className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400 ${error ? 'border-red-400' : 'border-stone-300'} ${className}`}
        {...props}
      />
      {error && <span className="text-red-600 text-xs mt-0.5 block">{error}</span>}
    </label>
  );
}
