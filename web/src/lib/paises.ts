/** Países de destino: América Latina primeiro, depois alguns destinos comuns. */
export const PAISES_AMERICA_LATINA = [
  'AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'CU', 'EC', 'SV', 'GT', 'HN', 'MX', 'NI', 'PA', 'PY', 'PE', 'DO', 'UY', 'VE',
];
export const OUTROS_PAISES = ['US', 'CA', 'PT', 'ES', 'IT', 'FR'];

const nomes = (() => {
  try {
    return new Intl.DisplayNames(['pt-BR'], { type: 'region' });
  } catch {
    return null;
  }
})();

export function nomePais(codigo: string) {
  return nomes?.of(codigo) ?? codigo;
}

/** Emoji da bandeira a partir do código ISO-2. */
export function bandeira(codigo: string) {
  return [...codigo.toUpperCase()].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('');
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ',
  'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

/** "Gramado/RS" no Brasil; "🇦🇷 Bariloche, Río Negro · Argentina" fora. */
export function formatDestino(v: { destinoCidade: string; destinoUf?: string | null; destinoPais?: string | null }) {
  const pais = v.destinoPais ?? 'BR';
  if (pais === 'BR') return `${v.destinoCidade}${v.destinoUf ? `/${v.destinoUf}` : ''}`;
  return `${bandeira(pais)} ${v.destinoCidade}${v.destinoUf ? `, ${v.destinoUf}` : ''} · ${nomePais(pais)}`;
}

/** Cidade do cliente: "Blumenau/SC" no Brasil; "🇺🇾 Montevideo · Uruguai" fora. Vazio sem cidade. */
export function formatCidade(c: { cidade: string | null; uf?: string | null; pais?: string | null }) {
  if (!c.cidade) return '';
  const pais = c.pais ?? 'BR';
  if (pais === 'BR') return `${c.cidade}${c.uf ? `/${c.uf}` : ''}`;
  return `${bandeira(pais)} ${c.cidade}${c.uf ? `, ${c.uf}` : ''} · ${nomePais(pais)}`;
}
