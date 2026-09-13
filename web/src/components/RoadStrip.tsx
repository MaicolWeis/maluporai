// Faixa de estrada — elemento de identidade visual do maluporai.
export function RoadStrip({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-2 w-full bg-zinc-900 ${className}`}
      style={{
        backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 14px, #fbbf24 14px 26px)',
        backgroundSize: 'auto 2px',
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat-x',
      }}
    />
  );
}
