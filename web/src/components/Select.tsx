import type { SelectHTMLAttributes } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export function Select({ label, error, className = '', children, ...props }: Props) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <select
        className={`mt-1.5 w-full h-11 md:h-9 border rounded-md px-3 text-base md:text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand ${error ? 'border-red-400' : 'border-slate-200'} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-red-600 text-xs mt-1 block font-normal">{error}</span>}
    </label>
  );
}
