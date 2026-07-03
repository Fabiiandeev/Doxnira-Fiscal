import { normalizeCnpj } from "../../utils/cnpj.js";

const SITUACAO_MAP = { 1: "ATIVA", 2: "SUSPENSA", 3: "BAIXADA", 4: "NULA" };
const PORTE_MAP = { 0: null, 1: "ME", 2: "ME/EPP", 3: "EPP", 4: "MEI", 5: "DEMAIS" };

async function fetchWithTimeout(url, timeout = 10_000, headers = {}) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "NSFiscalCloud/1.0", ...headers },
    });
  } finally {
    clearTimeout(tid);
  }
}

function formatCnae(value) {
  const d = String(value || "").replace(/\D/g, "");
  if (d.length !== 7) return d || null;
  return `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5)}`;
}

function mapSituacao(code) {
  if (code == null) return null;
  return SITUACAO_MAP[Number(code)] || null;
}

function mapPorte(code) {
  if (code == null) return null;
  return PORTE_MAP[Number(code)] || null;
}

function telefoneWithDdd(tel, ddd) {
  if (!tel) return null;
  const digits = String(tel).replace(/\D/g, "");
  if (!digits) return null;
  if (ddd && (digits.length === 8 || digits.length === 9)) return `${ddd}${digits}`;
  return digits;
}

export class BaseProvider {
  get name() { return "base"; }
  get priority() { return 99; }
  get trustScore() { return 0; }

  async lookup(cnpj) {
    throw new Error("Not implemented");
  }

  normalize(raw) {
    return {
      razaoSocial: raw.razaoSocial || null,
      nomeFantasia: raw.nomeFantasia || null,
      cnpj: normalizeCnpj(raw.cnpj || ""),
      dataAbertura: raw.dataAbertura || null,
      naturezaJuridica: raw.naturezaJuridica || null,
      naturezaJuridicaCodigo: raw.naturezaJuridicaCodigo || null,
      porte: raw.porte || null,
      capitalSocial: raw.capitalSocial || null,
      situacaoCadastral: raw.situacaoCadastral || null,
      situacaoCadastralData: raw.situacaoCadastralData || null,
      situacaoMotivo: raw.situacaoMotivo || null,
      optanteSimples: raw.optanteSimples ?? null,
      mei: raw.mei ?? null,
      dataOpcaoSimples: raw.dataOpcaoSimples || null,
      dataExclusaoSimples: raw.dataExclusaoSimples || null,
      matriz: raw.matriz ?? null,
      filial: raw.filial ?? null,
      cnaePrincipal: raw.cnaePrincipal || null,
      cnaeSecundarios: raw.cnaeSecundarios || null,
      inscricaoEstadual: raw.inscricaoEstadual || null,
      inscricaoEstadualFormatada: raw.inscricaoEstadualFormatada || null,
      ieUf: raw.ieUf || null,
      ieSituacao: raw.ieSituacao || null,
      ieFonte: raw.ieFonte || null,
      inscricaoMunicipal: raw.inscricaoMunicipal || null,
      cep: raw.cep || null,
      logradouro: raw.logradouro || null,
      numero: raw.numero || null,
      complemento: raw.complemento || null,
      bairro: raw.bairro || null,
      cidade: raw.cidade || null,
      uf: raw.uf || null,
      codigoIbge: raw.codigoIbge || null,
      pais: raw.pais || "BRASIL",
      latitude: raw.latitude || null,
      longitude: raw.longitude || null,
      telefone: raw.telefone || null,
      telefone2: raw.telefone2 || null,
      email: raw.email || null,
      site: raw.site || null,
      qsa: raw.qsa || null,
      _source: this.name,
      _trust: this.trustScore,
    };
  }

  protectedFetch(url, timeout, headers) {
    return fetchWithTimeout(url, timeout, headers);
  }

  _formatCnae = formatCnae;
  _mapSituacao = mapSituacao;
  _mapPorte = mapPorte;
  _normalizeCnpj = normalizeCnpj;
  _telefoneWithDdd = telefoneWithDdd;
}
