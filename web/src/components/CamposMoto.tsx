import { Input } from './Input';

const MARCAS = [
  'BMW', 'Benelli', 'Dafra', 'Ducati', 'Harley-Davidson', 'Haojue', 'Honda', 'Kawasaki', 'KTM', 'Royal Enfield',
  'Shineray', 'Suzuki', 'Triumph', 'Yamaha',
];

/** Marca (com sugestões das mais comuns no Brasil) e modelo da moto do cliente. */
export function CamposMoto({
  marca,
  modelo,
  onChange,
}: {
  marca: string;
  modelo: string;
  onChange: (v: { marca: string; modelo: string }) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="flex-1">
        <Input
          label="Marca da moto"
          list="marcas-moto"
          placeholder="Ex.: Honda"
          maxLength={60}
          value={marca}
          onChange={(e) => onChange({ marca: e.target.value, modelo })}
        />
        <datalist id="marcas-moto">
          {MARCAS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <div className="flex-1">
        <Input
          label="Modelo da moto"
          placeholder="Ex.: CB 500X"
          maxLength={80}
          value={modelo}
          onChange={(e) => onChange({ marca, modelo: e.target.value })}
        />
      </div>
    </div>
  );
}
