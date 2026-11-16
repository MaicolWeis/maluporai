import { Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const CHAVE = 'maluporai:dica-instalar-dispensada';

function lerDispensada() {
  try {
    return localStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
}

function instalado() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Faixa "Instalar o app" no celular. Android/Chrome: usa o prompt nativo.
 * iPhone: não há prompt — mostra o caminho Compartilhar → Adicionar à Tela de Início.
 */
export function DicaInstalar() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [visivel, setVisivel] = useState(false);
  const ehIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    if (instalado() || lerDispensada()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
      setVisivel(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    if (ehIOS) setVisivel(true);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [ehIOS]);

  const dispensar = () => {
    setVisivel(false);
    try {
      localStorage.setItem(CHAVE, '1');
    } catch {
      /* navegação privada etc. — só esconde nesta sessão */
    }
  };

  if (!visivel) return null;

  return (
    <div className="md:hidden mb-3 flex items-center gap-3 rounded-xl border border-brand-border bg-brand-soft px-3 py-2 text-xs text-brand-ink">
      <img src="/icon-192.png" alt="" className="h-8 w-8 rounded-md" />
      <div className="flex-1">
        {evento ? (
          <>Instale o maluporai no celular para abrir como app.</>
        ) : (
          <>
            Para instalar: toque em <Share size={12} className="inline -mt-0.5" /> <strong>Compartilhar</strong> e depois
            em <strong>Adicionar à Tela de Início</strong>.
          </>
        )}
      </div>
      {evento && (
        <button
          type="button"
          onClick={async () => {
            await evento.prompt();
            dispensar();
          }}
          className="h-8 px-3 rounded-md bg-brand text-white font-semibold"
        >
          Instalar
        </button>
      )}
      <button type="button" onClick={dispensar} aria-label="Dispensar" className="text-brand-ink/70">
        <X size={16} />
      </button>
    </div>
  );
}
