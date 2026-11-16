import { MessageCircle, Phone } from 'lucide-react';

/** Só dígitos; números brasileiros sem DDI ganham o 55 para o WhatsApp. */
function paraWhatsApp(telefone: string) {
  const d = telefone.replace(/\D/g, '');
  if (!d) return null;
  return d.length <= 11 ? `55${d}` : d;
}

/**
 * Atalhos de contato para uso no celular: ligar e abrir conversa no WhatsApp.
 * stopPropagation para não abrir o card/linha onde estão.
 */
export function ContatoAcoes({ telefone, nome }: { telefone: string | null | undefined; nome?: string }) {
  const wa = telefone ? paraWhatsApp(telefone) : null;
  if (!telefone || !wa || telefone === 'ANONIMIZADO') return null;
  const tel = telefone.replace(/[^\d+]/g, '');
  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <a
        href={`tel:${tel}`}
        title={nome ? `Ligar para ${nome}` : 'Ligar'}
        aria-label={nome ? `Ligar para ${nome}` : 'Ligar'}
        className="h-8 w-8 md:h-7 md:w-7 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:border-brand-border hover:text-brand"
      >
        <Phone size={14} />
      </a>
      <a
        href={`https://wa.me/${wa}`}
        target="_blank"
        rel="noopener noreferrer"
        title={nome ? `WhatsApp de ${nome}` : 'WhatsApp'}
        aria-label={nome ? `WhatsApp de ${nome}` : 'WhatsApp'}
        className="h-8 w-8 md:h-7 md:w-7 inline-flex items-center justify-center rounded-md border border-slate-200 text-emerald-700 hover:border-emerald-300"
      >
        <MessageCircle size={14} />
      </a>
    </span>
  );
}
