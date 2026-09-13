import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-zinc-900 text-amber-400 hover:bg-zinc-800',
  secondary: 'bg-white border border-stone-300 text-zinc-800 hover:border-amber-400',
  ghost: 'text-zinc-500 hover:text-zinc-900',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className = '', ...props }: Props) {
  return (
    <button
      className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
