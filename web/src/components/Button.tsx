import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

// NSDS: 36px de altura, raio 6.4px, 12–13px, primário na cor de marca.
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover font-semibold',
  secondary: 'bg-white border border-slate-200 text-slate-700 hover:border-brand-border hover:bg-brand-soft font-medium',
  ghost: 'text-slate-500 hover:text-slate-900 font-medium',
  danger: 'bg-red-600 text-white hover:bg-red-700 font-semibold',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className = '', ...props }: Props) {
  return (
    <button
      className={`h-11 md:h-9 px-4 rounded-md text-sm md:text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
