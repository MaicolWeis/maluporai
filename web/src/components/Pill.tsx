export function Pill({ children, cls = 'bg-stone-100 text-zinc-700 border border-stone-200' }: { children: React.ReactNode; cls?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
}
