import type { InputHTMLAttributes } from 'react';
import { Input } from './Input';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** "1234.5" | 1234.5 → "R$ 1.234,50"; vazio → "". */
function exibir(valor: string | number | undefined | null) {
  if (valor === '' || valor == null) return '';
  const n = Number(valor);
  return Number.isFinite(n) ? moeda.format(n) : '';
}

/** Só os dígitos digitados, lidos como centavos: "R$ 1.234,56" → "1234.56". */
function normalizar(texto: string) {
  const digitos = texto.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digitos) return '';
  return (Number(digitos) / 100).toFixed(2);
}

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  label: string;
  error?: string;
  /** Valor decimal com ponto ("1234.56") ou vazio — mesmo formato que a API recebe. */
  value: string | number;
  /** Recebe o valor já normalizado em `e.target.value` ("1234.56" ou ""). */
  onChange: (e: { target: { value: string } }) => void;
}

/**
 * Campo de valor em Reais com máscara (R$ 1.234,56). Digitação estilo
 * caixa registradora: os dígitos entram pela direita, centavos primeiro.
 */
export function MoneyInput({ value, onChange, className = '', ...props }: Props) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={props.placeholder ?? 'R$ 0,00'}
      className={`font-mono tabular-nums ${className}`}
      value={exibir(value)}
      onChange={(e) => onChange({ target: { value: normalizar(e.target.value) } })}
    />
  );
}
