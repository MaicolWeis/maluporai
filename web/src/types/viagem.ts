export type ViagemStatus = 'planejamento' | 'inscricoes' | 'confirmada' | 'concluida' | 'cancelada';

export interface Agregados {
  pessoasConfirmadas: number;
  capacidade: number;
  totalRecebido: string;
  totalDespesas: string;
}

export interface ViagemListItem {
  id: string;
  nome: string;
  destinoCidade: string;
  destinoUf: string;
  dataInicio: string;
  dataFim: string;
  status: ViagemStatus;
  pessoasConfirmadas: number;
  capacidade: number;
  totalRecebido: string;
  totalDespesas: string;
}

export interface Hotel {
  id: string;
  nome: string;
  cidade: string | null;
  telefone: string | null;
  checkIn: string | null;
  checkOut: string | null;
  valorNegociado: string | null;
  observacoes: string | null;
}

export type AtracaoTipo = 'parque' | 'passeio' | 'refeicao' | 'outro';

export interface Atracao {
  id: string;
  nome: string;
  tipo: AtracaoTipo;
  valorEntrada: string | null;
  incluso: boolean;
  observacoes: string | null;
}

export interface Incluso {
  id: string;
  descricao: string;
  ordem: number;
}

export type InscricaoStatus = 'confirmada' | 'cancelada' | 'lista_espera';
export type StatusPagamento = 'pago' | 'parcial' | 'pendente';
export type PagamentoForma = 'pix' | 'cartao' | 'dinheiro' | 'transferencia';

export interface InscricaoItem {
  id: string;
  status: InscricaoStatus;
  cliente: { id: string; nome: string; telefone: string };
  levaAcompanhante: boolean;
  nomeAcompanhante: string | null;
  seguroViagem: boolean;
  valorTotal: string;
  valorPago: string;
  statusPagamento: StatusPagamento;
  formaPagamentoPredominante: PagamentoForma | null;
  createdAt: string;
}

export interface InscricoesDaViagem {
  inscricoes: InscricaoItem[];
  capacidade: number;
  pessoasConfirmadas: number;
  vagasRestantes: number;
}

export interface ViagemDetalhe {
  id: string;
  nome: string;
  destinoCidade: string;
  destinoUf: string;
  dataInicio: string;
  dataFim: string;
  capacidade: number;
  precoTitular: string;
  precoAcompanhante: string | null;
  status: ViagemStatus;
  descricao: string | null;
  createdAt: string;
  updatedAt: string;
  hoteis: Hotel[];
  atracoes: Atracao[];
  inclusos: Incluso[];
  agregados: Agregados;
}
