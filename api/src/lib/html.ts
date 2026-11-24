/** Escapa texto vindo de usuário antes de interpolar em HTML (e-mails). */
export function escaparHtml(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
