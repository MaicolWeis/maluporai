import { api } from './api';
import type { StatusPagamento } from '../types/viagem';

/**
 * Lista de embarque guardada no aparelho para o guia consultar e marcar
 * embarques sem internet (estrada, rodoviária, serra).
 *
 * Dados mínimos de propósito (LGPD, minimização): nome, telefone, nome do
 * acompanhante, situação do pagamento e embarque. Sem CPF, documento, e-mail
 * ou valores. Tudo é apagado ao sair da conta, ao entrar com outro usuário e
 * dois dias depois do fim da viagem.
 */

const PREFIXO = 'maluporai:embarque:';
const CHAVE_DONO = 'maluporai:embarque-dono';
const CHAVE_FILA = 'maluporai:embarque-fila';
const DIAS_APOS_FIM = 2;

export interface InscritoOffline {
  id: string;
  nome: string;
  telefone: string;
  nomeAcompanhante: string | null;
  statusPagamento: StatusPagamento;
  embarcadoEm: string | null;
}

export interface ListaOffline {
  viagem: { id: string; nome: string; destino: string; dataInicio: string; dataFim: string };
  salvaEm: string;
  inscritos: InscritoOffline[];
}

export interface MarcacaoPendente {
  inscricaoId: string;
  viagemId: string;
  embarcado: boolean;
  em: string;
}

function ler<T>(chave: string): T | null {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem espaço ou navegação privada: a lista só não fica disponível offline */
  }
}

function chavesDeListas() {
  const chaves: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIXO)) chaves.push(k);
    }
  } catch {
    /* ignora */
  }
  return chaves;
}

function expirada(lista: ListaOffline) {
  const limite = new Date(`${lista.viagem.dataFim.slice(0, 10)}T23:59:59`);
  limite.setDate(limite.getDate() + DIAS_APOS_FIM);
  return Date.now() > limite.getTime();
}

/** Troca de usuário no mesmo aparelho apaga o que o anterior deixou. */
export function garantirDono(userId: string) {
  const dono = ler<string>(CHAVE_DONO);
  if (dono && dono !== userId) limparTudo();
  gravar(CHAVE_DONO, userId);
}

export function salvarLista(lista: Omit<ListaOffline, 'salvaEm'>) {
  // Marcações ainda não enviadas prevalecem sobre o que veio do servidor.
  const fila = filaPendente().filter((m) => m.viagemId === lista.viagem.id);
  const inscritos = lista.inscritos.map((i) => {
    const pendente = fila.find((m) => m.inscricaoId === i.id);
    return pendente ? { ...i, embarcadoEm: pendente.embarcado ? pendente.em : null } : i;
  });
  gravar(PREFIXO + lista.viagem.id, { ...lista, inscritos, salvaEm: new Date().toISOString() });
}

export function lerLista(viagemId: string): ListaOffline | null {
  const lista = ler<ListaOffline>(PREFIXO + viagemId);
  if (!lista) return null;
  if (expirada(lista)) {
    removerLista(viagemId);
    return null;
  }
  return lista;
}

export function listasSalvas(): ListaOffline[] {
  return chavesDeListas()
    .map((k) => lerLista(k.slice(PREFIXO.length)))
    .filter((l): l is ListaOffline => !!l)
    .sort((a, b) => a.viagem.dataInicio.localeCompare(b.viagem.dataInicio));
}

function removerLista(viagemId: string) {
  try {
    localStorage.removeItem(PREFIXO + viagemId);
  } catch {
    /* ignora */
  }
}

export function filaPendente(): MarcacaoPendente[] {
  return ler<MarcacaoPendente[]>(CHAVE_FILA) ?? [];
}

/** Marca no aparelho e enfileira para enviar quando houver internet. */
export function marcarLocal(viagemId: string, inscricaoId: string, embarcado: boolean): string | null {
  const em = new Date().toISOString();
  const lista = ler<ListaOffline>(PREFIXO + viagemId);
  let embarcadoEm: string | null = null;
  if (lista) {
    lista.inscritos = lista.inscritos.map((i) => {
      if (i.id !== inscricaoId) return i;
      embarcadoEm = embarcado ? (i.embarcadoEm ?? em) : null;
      return { ...i, embarcadoEm };
    });
    gravar(PREFIXO + viagemId, lista);
  }
  const fila = filaPendente().filter((m) => m.inscricaoId !== inscricaoId);
  fila.push({ inscricaoId, viagemId, embarcado, em: embarcadoEm ?? em });
  gravar(CHAVE_FILA, fila);
  return embarcadoEm;
}

let sincronizando: Promise<number> | null = null;

/**
 * Envia as marcações pendentes. Para no primeiro erro de rede (continua sem
 * internet); marcação recusada pelo servidor (inscrição cancelada, viagem
 * concluída…) é descartada. Devolve quantas foram enviadas.
 */
export function sincronizar(): Promise<number> {
  if (sincronizando) return sincronizando;
  sincronizando = (async () => {
    let enviadas = 0;
    for (const m of filaPendente()) {
      try {
        await api.post(`/inscricoes/${m.inscricaoId}/embarque`, { embarcado: m.embarcado, em: m.em });
        enviadas++;
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (!status || status === 401 || status >= 500) break;
        // 4xx definitivo: descarta
      }
      gravar(
        CHAVE_FILA,
        filaPendente().filter((x) => !(x.inscricaoId === m.inscricaoId && x.em === m.em)),
      );
    }
    return enviadas;
  })().finally(() => {
    sincronizando = null;
  });
  return sincronizando;
}

export function limparTudo() {
  try {
    for (const k of chavesDeListas()) localStorage.removeItem(k);
    localStorage.removeItem(CHAVE_FILA);
    localStorage.removeItem(CHAVE_DONO);
  } catch {
    /* ignora */
  }
}
