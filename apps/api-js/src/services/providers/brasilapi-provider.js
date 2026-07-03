import { BaseProvider } from "./base-provider.js";

export class BrasilApiProvider extends BaseProvider {
  get name() { return "brasilapi"; }
  get priority() { return 2; }
  get trustScore() { return 85; }

  async lookup(cnpj) {
    const normalized = this._normalizeCnpj(cnpj);
    const response = await this.protectedFetch(`https://brasilapi.com.br/api/cnpj/v1/${normalized}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`BrasilAPI HTTP ${response.status}`);
    const data = await response.json();
    return this.normalize(this._mapRaw(data));
  }

  _mapRaw(data) {
    const opSimples = data.opcao_pelo_simples === true ? true : data.opcao_pelo_simples === false ? false : null;
    const opMei = data.opcao_pelo_mei === true ? true : data.opcao_pelo_mei === false ? false : null;
    const cnaeDigits = String(data.cnae_fiscal || "").replace(/\D/g, "");
    const cepDigits = data.cep ? String(data.cep).replace(/\D/g, "") : null;
    const natJurStr = data.natureza_juridica || "";
    const natJurCodigo = natJurStr.includes(" - ") ? natJurStr.split(" - ")[0].trim() : null;
    const secundarios = (data.cnaes_secundarias || []).map(c => ({
      codigo: String(c.codigo || "").replace(/\D/g, "") || null,
      descricao: c.descricao || null,
    })).filter(c => c.codigo);
    const tel = this._telefoneWithDdd(data.telefone, data.ddd);

    return {
      cnpj: data.cnpj || null,
      razaoSocial: data.razao_social || null,
      nomeFantasia: data.nome_fantasia || null,
      logradouro: data.logradouro || null,
      numero: data.numero || null,
      complemento: data.complemento || null,
      bairro: data.bairro || null,
      cep: cepDigits,
      cidade: data.municipio || null,
      uf: data.uf || null,
      cnaePrincipal: {
        codigo: cnaeDigits || null,
        codigoFormatado: this._formatCnae(data.cnae_fiscal),
        descricao: data.cnae_fiscal_descricao || null,
      },
      cnaeSecundarios: secundarios,
      telefone: tel,
      email: data.email || null,
      dataAbertura: data.data_inicio_atividade || null,
      situacaoCadastral: data.descricao_situacao_cadastral || this._mapSituacao(data.situacao_cadastral),
      situacaoCadastralData: data.situacao_cadastral_data || null,
      naturezaJuridica: natJurStr || null,
      naturezaJuridicaCodigo: natJurCodigo,
      porte: data.descricao_porte || null,
      capitalSocial: data.capital_social != null ? String(data.capital_social) : null,
      optanteSimples: opSimples,
      mei: opMei,
      inscricaoEstadual: null,
      ieFonte: "NAO_ENCONTRADA",
      qsa: null,
    };
  }
}
