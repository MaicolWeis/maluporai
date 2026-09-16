/** Mantém só dígitos — aceita CPF digitado com ou sem pontuação. */
export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/** ***.***.***-12 — só os 2 últimos dígitos ficam visíveis. */
export function maskCpf(cpf: string): string {
  const digits = normalizeCpf(cpf);
  const ultimos = digits.slice(-2).padStart(2, '*');
  return `***.***.***-${ultimos}`;
}
