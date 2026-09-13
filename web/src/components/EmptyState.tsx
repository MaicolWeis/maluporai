export function EmptyState({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <div className="text-center py-12">
      <p className="font-bold text-zinc-500">{titulo}</p>
      {descricao && <p className="text-sm text-zinc-400 mt-1">{descricao}</p>}
    </div>
  );
}
