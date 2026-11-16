import { ArrowLeft, CloudOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListaEmbarque } from '../components/AbaEmbarque';
import { filaPendente, listasSalvas, marcarLocal, type ListaOffline } from '../lib/embarqueOffline';
import { formatDataCivil } from '../lib/format';

/**
 * Tela usada sem internet (sem sessão — o login precisa da API): mostra as
 * listas de embarque guardadas no aparelho e permite marcar embarques, que
 * ficam na fila até o guia entrar de novo com internet.
 */
export function EmbarqueOffline() {
  const [listas, setListas] = useState<ListaOffline[]>(() => listasSalvas());
  const [aberta, setAberta] = useState<string | null>(() => (listasSalvas().length === 1 ? listasSalvas()[0].viagem.id : null));
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const lista = listas.find((l) => l.viagem.id === aberta);
  const pendentes = filaPendente().filter((m) => m.viagemId === aberta).length;

  return (
    <div className="min-h-[100dvh] bg-slate-100">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 pt-[env(safe-area-inset-top)]">
        <div className="h-12 px-4 flex items-center gap-2">
          {lista && listas.length > 1 ? (
            <button type="button" onClick={() => setAberta(null)} aria-label="Voltar" className="text-slate-500">
              <ArrowLeft size={18} />
            </button>
          ) : null}
          <p className="font-semibold text-slate-900 truncate flex-1">{lista ? lista.viagem.nome : 'Listas de embarque'}</p>
          <Link to="/login" className="text-xs font-semibold text-brand">
            Entrar
          </Link>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <p
          className={`flex items-start gap-1.5 text-xs rounded-lg px-3 py-2 border ${
            online ? 'bg-brand-soft border-brand-border text-brand-ink' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <CloudOff size={13} className="mt-0.5 shrink-0" />
          {online
            ? 'A internet voltou. Entre na sua conta para enviar os embarques marcados aqui.'
            : 'Sem internet. Você está vendo as listas salvas neste aparelho; os embarques marcados são enviados quando você entrar de novo com internet.'}
        </p>

        {listas.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-10">
            Nenhuma lista salva neste aparelho. Abra a aba Embarque de uma viagem com internet para salvá-la.
          </p>
        ) : lista ? (
          <>
            <p className="text-xs text-slate-500">
              {lista.viagem.destino} · {formatDataCivil(lista.viagem.dataInicio)} · lista salva em{' '}
              {new Date(lista.salvaEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
            <ListaEmbarque
              inscritos={lista.inscritos}
              pendentes={pendentes}
              onAlternar={(i) => {
                marcarLocal(lista.viagem.id, i.id, !i.embarcadoEm);
                setListas(listasSalvas());
              }}
            />
          </>
        ) : (
          <ul className="space-y-2">
            {listas.map((l) => (
              <li key={l.viagem.id}>
                <button
                  type="button"
                  onClick={() => setAberta(l.viagem.id)}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 shadow-card p-3"
                >
                  <p className="font-semibold text-slate-900">{l.viagem.nome}</p>
                  <p className="text-xs text-slate-500">
                    {l.viagem.destino} · {formatDataCivil(l.viagem.dataInicio)} ·{' '}
                    {l.inscritos.filter((i) => i.embarcadoEm).length}/{l.inscritos.length} inscrições embarcadas
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
