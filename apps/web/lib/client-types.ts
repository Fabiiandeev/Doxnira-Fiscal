export interface IntelligentClient {
  id: string;
  ownerId: string;
  tipoPessoa: "PJ" | "PF";

  nome: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;

  cpf: string | null;
  cnpj: string | null;
  rg: string | null;
  dataNascimento: string | null;

  naturezaJuridica: string | null;
  porte: string | null;
  capitalSocial: string | null;
  dataAbertura: string | null;
  situacaoCadastral: string | null;
  situacaoMotivo: string | null;
  situacaoData: string | null;
  optanteSimples: boolean | null;
  mei: boolean | null;
  empresaPublica: boolean | null;
  filial: boolean | null;
  matriz: boolean | null;

  regimeTributario: string | null;
  crt: string | null;
  descricaoCrt: string | null;
  indicadorIe: string | null;
  inscricaoEstadual: string | null;
  ieStatus: string | null;
  inscricaoMunicipal: string | null;
  imStatus: string | null;
  tipoContribuinte: string | null;
  contribuinteIcms: boolean | null;
  contribuinteIss: boolean | null;
  substituicaoTributaria: boolean | null;
  retencoes: Retencoes | null;

  cnae: string | null;
  atividadeEconomica: string | null;
  cnaeSecundarios: CnaeItem[] | null;
  riscoFiscalCnae: string | null;
  atividadesPermitidas: string[] | null;
  atividadesIncompativeis: string[] | null;

  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  codigoIbge: string | null;
  codigoUfIbge: string | null;
  pais: string | null;
  latitude: number | null;
  longitude: number | null;

  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  site: string | null;
  contatoFinanceiro: string | null;
  contatoFiscal: string | null;

  fiscalAi: FiscalAiResult | null;
  scoreCadastro: number | null;
  scoreDetalhes: ScoreDetalhes | null;

  reformaPrep: ReformaPrep | null;

  observacoes: string | null;
  fonteDados: string | null;
  dadosOriginaisJson: unknown;
  alertasJson: unknown;
  validadoPorIa: boolean;
  historicoJson: HistoricoEntry[] | null;
  ultimaConsulta: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface CnaeItem {
  codigo: string;
  descricao: string;
}

export interface Retencoes {
  irrf: boolean;
  csll: boolean;
  pis: boolean;
  cofins: boolean;
  iss: boolean;
}

export interface FiscalAiResult {
  podeEmitirNfe: boolean;
  podeEmitirNfse: boolean;
  podeEmitirNfce: boolean;
  podeReceberCte: boolean;
  necessitaIe: boolean;
  necessitaIm: boolean;
  necessitaContador: boolean;
  necessitaCertificado: boolean;
  necessitaCadastroComplementar: boolean;
}

export interface ScoreDetalhes {
  cadastrais: number;
  fiscais: number;
  endereco: number;
  contato: number;
  sped: number;
  nfse: number;
}

export interface ReformaPrep {
  ibs: string | null;
  cbs: string | null;
  is: string | null;
  domicilioTributario: boolean;
  cadastroCentralizado: boolean;
  manifestacaoDestinatario: boolean;
}

export interface HistoricoEntry {
  quem: string;
  quando: string;
  campo: string;
  valorAnterior: string | null;
  valorNovo: string | null;
  origem: "FISCAL_AI" | "USUARIO" | "CONTADOR" | "INTEGRACAO";
}

export interface SmartError {
  id: string;
  campo: string;
  titulo: string;
  explicacao: string;
  impacto: string;
  regraUtilizada: string;
  correcaoSugerida: string;
  confianca: "ALTA" | "MEDIA" | "BAIXA" | "INFORMATIVO";
  tipo: "ERRO" | "ALERTA" | "DICA";
  acoes: SmartErrorAction[];
  corrigido: boolean;
}

export interface SmartErrorAction {
  label: string;
  acao: "CORRIGIR" | "IGNORAR" | "ENVIAR_CONTADOR" | "EDITAR";
}

export interface ClientLookupResult {
  success: boolean;
  tipoPessoa: "PJ" | "PF";
  cnpj?: string | null;
  cpf?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  nome?: string | null;
  inscricaoEstadual?: string | null;
  inscricaoMunicipal?: string | null;
  regimeTributario?: string | null;
  cnae?: string | null;
  atividadeEconomica?: string | null;
  situacaoCadastral?: string | null;
  naturezaJuridica?: string | null;
  porte?: string | null;
  capitalSocial?: string | null;
  dataAbertura?: string | null;
  telefone?: string | null;
  telefone1?: string | null;
  telefone2?: string | null;
  email?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  codigoIbge?: string | null;
  codigoUfIbge?: string | null;
  ddd?: string | null;
  pais?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  fonte?: string | null;
  dadosOriginais?: unknown;
  alertas?: { code: string; message: string }[];
  situacaoMotivo?: string | null;
  situacaoData?: string | null;
  optanteSimples?: boolean | null;
  mei?: boolean | null;
  matriz?: boolean | null;
  filial?: boolean | null;
  crt?: string | null;
  descricaoCrt?: string | null;
  indicadorIe?: string | null;
  tipoContribuinte?: string | null;
  contribuinteIcms?: boolean | null;
  contribuinteIss?: boolean | null;
  cnaeSecundarios?: CnaeItem[] | null;
  retencoes?: Retencoes | null;
  ieStatus?: string | null;
  imStatus?: string | null;
}

export interface ClientValidationResult {
  success: boolean;
  podeEmitir: boolean;
  normalizacoes: Record<string, string>;
  alertas: SmartError[];
  pendencias: SmartError[];
  dicas: SmartError[];
  sugestoesCorrecao: string[];
  validadoPorIa: boolean;
  mensagem: string;
  podeEmitirNfe: boolean;
  podeEmitirNfse: boolean;
  podeEmitirNfce: boolean;
  podeReceberCte: boolean;
  necessitaIe: boolean;
  necessitaIm: boolean;
  necessitaContador: boolean;
  necessitaCertificado: boolean;
  necessitaCadastroComplementar: boolean;
  scoreCadastro: number;
  scoreDetalhes: ScoreDetalhes;
}
