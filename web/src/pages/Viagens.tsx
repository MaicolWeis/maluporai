import { EmptyState } from '../components/EmptyState';

export function Viagens() {
  return (
    <div>
      <h1 className="text-2xl font-black mb-6">Viagens</h1>
      <EmptyState
        titulo="Nenhuma viagem ainda"
        descricao="O CRUD de viagens chega no P6, com os cards e o drawer do protótipo aprovado."
      />
    </div>
  );
}
