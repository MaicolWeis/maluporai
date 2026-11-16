// NSDS: pill de 20px, raio total, 11px/600, com borda.
export function Pill({ children, cls = 'bg-slate-50 text-slate-600 border border-slate-200' }: { children: React.ReactNode; cls?: string }) {
  return (
    <span className={`inline-flex items-center h-5 px-2 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
}
