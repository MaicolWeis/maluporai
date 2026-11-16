import { CamposLocalidade } from './CamposLocalidade';

export interface Destino {
  destinoCidade: string;
  destinoUf: string;
  destinoPais: string;
}

/** Destino da viagem: país + cidade + UF/província (cidade obrigatória; UF obrigatória no Brasil). */
export function CamposDestino({ valor, onChange }: { valor: Destino; onChange: (v: Destino) => void }) {
  return (
    <CamposLocalidade
      obrigatorio
      rotuloPais="País de destino"
      valor={{ pais: valor.destinoPais, cidade: valor.destinoCidade, estado: valor.destinoUf }}
      onChange={(l) => onChange({ destinoPais: l.pais, destinoCidade: l.cidade, destinoUf: l.estado })}
    />
  );
}
