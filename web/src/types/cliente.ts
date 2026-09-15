export interface ClienteListItem {
  id: string;
  nome: string;
  telefone: string;
  cidade: string | null;
  uf: string | null;
  consentimentoMarketing: boolean;
  anonimizadoEm: string | null;
  viagens: { id: string; nome: string }[];
}

export interface InscricaoResumo {
  id: string;
  viagem: { id: string; nome: string; destinoCidade: string; destinoUf: string };
  status: 'confirmada' | 'cancelada' | 'lista_espera';
  valorTotal: string;
  valorPago: string;
  statusPagamento: 'pago' | 'parcial' | 'pendente';
  createdAt: string;
}

export interface ClienteDetalhe {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  dataNascimento: string | null;
  contatoEmergenciaNome: string | null;
  contatoEmergenciaTelefone: string | null;
  observacoes: string | null;
  consentimentoMarketing: boolean;
  consentimentoEm: string | null;
  anonimizadoEm: string | null;
  createdAt: string;
  updatedAt: string;
  cpfMascarado: string | null;
  inscricoes: InscricaoResumo[];
}
