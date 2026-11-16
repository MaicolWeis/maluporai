export type ViagemStatus = 'planejamento' | 'inscricoes' | 'confirmada' | 'concluida' | 'cancelada' | 'arquivada';

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

export interface InscricaoItem {
  id: string;
  status: InscricaoStatus;
  cliente: { id: string; nome: string; telefone: string };
  levaAcompanhante: boolean;
  nomeAcompanhante: string | null;
  docAcompanhante: string | null;
  seguroViagem: boolean;
  seguradora: string | null;
  numeroApolice: string | null;
  valorTotal: string;
  valorPago: string;
  statusPagamento: StatusPagamento;
  formaPagamentoPredominante: string | null;
  embarcadoEm: string | null;
  createdAt: string;
}

export interface InscricoesDaViagem {
  inscricoes: InscricaoItem[];
  capacidade: number;
  pessoasConfirmadas: number;
  vagasRestantes: number;
  pessoasEmbarcadas: number;
}

export interface Pagamento {
  id: string;
  inscricaoId: string;
  valor: string;
  forma: string;
  parcelas: number | null;
  dataPagamento: string;
  comprovanteUrl: string | null;
  observacoes: string | null;
  createdAt: string;
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

export interface Despesa {
  id: string;
  viagemId: string;
  categoria: string;
  descricao: string;
  valor: string;
  dataDespesa: string;
  comprovanteUrl: string | null;
  createdAt: string;
}

export interface DespesasDaViagem {
  despesas: Despesa[];
  total: string;
  totalPorCategoria: { categoria: string; total: string }[];
}

export interface FinanceiroViagem {
  receitaPrevista: string;
  recebido: string;
  aReceber: string;
  despesas: string;
  aDevolver: string;
  resultadoAtual: string;
  resultadoPrevisto: string;
  margemPrevista: number | null;
}

export interface Dashboard {
  hoje: string;
  aReceberNoMes: string;
  proximasViagens: {
    id: string;
    nome: string;
    destinoCidade: string;
    destinoUf: string;
    dataInicio: string;
    dataFim: string;
    status: ViagemStatus;
    capacidade: number;
    pessoasConfirmadas: number;
    recebido: string;
    aReceber: string;
  }[];
  pendencias: {
    inscricaoId: string;
    viagemId: string;
    viagemNome: string;
    dataInicio: string;
    clienteId: string;
    clienteNome: string;
    clienteTelefone: string;
    valorTotal: string;
    valorPago: string;
    saldo: string;
  }[];
  resultadoPorViagem: {
    viagemId: string;
    nome: string;
    dataInicio: string;
    recebido: string;
    despesas: string;
    resultadoAtual: string;
    resultadoPrevisto: string;
  }[];
}
