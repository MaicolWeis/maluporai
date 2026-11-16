import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

// NSDS: rótulo 11px/500 slate-500, campo 36px, borda slate-200, raio 6.4px, 13px.
export function Input({ label, error, className = '', ...props }: Props) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <input
        className={`mt-1.5 w-full h-9 border rounded-md px-3 text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:bg-slate-50 disabled:text-slate-500 ${error ? 'border-red-400' : 'border-slate-200'} ${className}`}
        {...props}
      />
      {error && <span className="text-red-600 text-xs mt-1 block font-normal">{error}</span>}
    </label>
  );
}
