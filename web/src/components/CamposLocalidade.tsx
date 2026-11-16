import { OUTROS_PAISES, PAISES_AMERICA_LATINA, UFS, bandeira, nomePais } from '../lib/paises';
import { Input } from './Input';
import { Select } from './Select';

export interface Localidade {
  pais: string;
  cidade: string;
  estado: string;
}

const ordenar = (lista: string[]) => [...lista].sort((a, b) => nomePais(a).localeCompare(nomePais(b), 'pt-BR'));

/**
 * País + cidade + UF (lista, no Brasil) ou estado/província (texto livre, fora).
 * Usado no destino da viagem e no endereço do cliente.
 */
export function CamposLocalidade({
  valor,
  onChange,
  obrigatorio = false,
  rotuloPais = 'País',
}: {
  valor: Localidade;
  onChange: (v: Localidade) => void;
  obrigatorio?: boolean;
  rotuloPais?: string;
}) {
  const noBrasil = valor.pais === 'BR';
  return (
    <div className="space-y-2">
      <Select label={rotuloPais} value={valor.pais} onChange={(e) => onChange({ ...valor, pais: e.target.value, estado: '' })}>
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
            required={obrigatorio}
            value={valor.cidade}
            onChange={(e) => onChange({ ...valor, cidade: e.target.value })}
          />
        </div>
        {noBrasil ? (
          <div className="w-24">
            <Select
              label="UF"
              required={obrigatorio}
              value={valor.estado}
              onChange={(e) => onChange({ ...valor, estado: e.target.value })}
            >
              <option value="">—</option>
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
              value={valor.estado}
              onChange={(e) => onChange({ ...valor, estado: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
