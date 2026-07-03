import { BaseProvider } from "./base-provider.js";

export class CnpjWsV2Provider extends BaseProvider {
  get name() { return "cnpj_wsv2"; }
  get priority() { return 4; }
  get trustScore() { return 75; }

  async lookup(cnpj) {
    const normalized = this._normalizeCnpj(cnpj);
    const response = await this.protectedFetch(`https://api.cnpj.ws/cnpj/${normalized}`, 10_000);
    if (response.status === 404 || response.status === 403) return null;
    if (!response.ok) throw new Error(`CNPJ.ws v2 HTTP ${response.status}`);
    const data = await response.json();
    return this.normalize(this._mapRaw(data, normalized));
  }

  _mapRaw(data, cnpj) {
    const est = data.estabelecimento || data.empresa || {};
    const uf = est.uf || data.uf || null;
    const opSimples = data.simples?.optante === true || data.optante_simples === true ? true : null;
    const opMei = data.simples?.mei === true || data.optante_mei === true ? true : null;
    const secundarios = (data.cnaes_secundarios || []).map(c => ({
      codigo: String(c.codigo || c.id || "").replace(/\D/g, "") || null,
      descricao: c.descricao || null,
    })).filter(c => c.codigo);

    return {
      cnpj,
      razaoSocial: data.razao_social || data.nome || null,
      nomeFantasia: est.nome_fantasia || data.fantasia || null,
      logradouro: est.logradouro || est.endereco || null,
      numero: est.numero || null,
      complemento: est.complemento || null,
      bairro: est.bairro || null,
      cep: est.cep ? String(est.cep).replace(/\D/g, "") : null,
      cidade: est.cidade || est.municipio || null,
      uf,
      cnaePrincipal: data.cnae_principal || data.cnae_fiscal
        ? { codigo: String((data.cnae_principal || data.cnae_fiscal || "").replace(/\D/g, "")), descricao: data.cnae_principal_descricao || null }
        : null,
      cnaeSecundarios: secundarios,
      telefone: est.telefone ? String(est.telefone).replace(/\D/g, "") : null,
      email: est.email || data.email || null,
      dataAbertura: est.data_inicio_atividade || data.abertura || null,
      situacaoCadastral: this._mapSituacao(est.situacao_cadastral) || data.situacao || null,
      naturezaJuridica: data.natureza_juridica || null,
      porte: this._mapPorte(data.porte) || data.porte_descricao || null,
      capitalSocial: data.capital_social != null ? String(data.capital_social) : null,
      optanteSimples: opSimples,
      mei: opMei,
    };
  }
}
