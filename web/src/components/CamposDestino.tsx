import { OUTROS_PAISES, PAISES_AMERICA_LATINA, UFS, bandeira, nomePais } from '../lib/paises';
import { Input } from './Input';
import { Select } from './Select';

export interface Destino {
  destinoCidade: string;
  destinoUf: string;
  destinoPais: string;
}

/** País + cidade + UF (Brasil) ou estado/província (fora do Brasil). */
export function CamposDestino({ valor, onChange }: { valor: Destino; onChange: (v: Destino) => void }) {
  const noBrasil = valor.destinoPais === 'BR';
  const ordenar = (lista: string[]) => [...lista].sort((a, b) => nomePais(a).localeCompare(nomePais(b), 'pt-BR'));
  return (
    <div className="space-y-2">
      <Select
        label="País de destino"
        value={valor.destinoPais}
        onChange={(e) => onChange({ ...valor, destinoPais: e.target.value, destinoUf: '' })}
      >
        <optgroup label="América Latina">
          {ordenar(PAISES_AMERICA_LATINA).map((p) => (
            <option key={p} value={p}>
              {bandeira(p)} {nomePais(p)}
            </option>
          ))}
        </optgroup>
        <optgroup label="Outros">
          {ordenar(OUTROS_PAISES).map((p) => (
            <option key={p} value={p}>
              {bandeira(p)} {nomePais(p)}
            </option>
          ))}
        </optgroup>
      </Select>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            label="Cidade"
            required
            value={valor.destinoCidade}
            onChange={(e) => onChange({ ...valor, destinoCidade: e.target.value })}
          />
        </div>
        {noBrasil ? (
          <div className="w-24">
            <Select
              label="UF"
              required
              value={valor.destinoUf}
              onChange={(e) => onChange({ ...valor, destinoUf: e.target.value })}
            >
              <option value="" disabled>
                —
              </option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="flex-1">
            <Input
              label="Estado/província (opcional)"
              value={valor.destinoUf}
              onChange={(e) => onChange({ ...valor, destinoUf: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
