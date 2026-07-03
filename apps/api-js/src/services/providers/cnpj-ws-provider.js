import { BaseProvider } from "./base-provider.js";

export class CnpjWsProvider extends BaseProvider {
  get name() { return "cnpj_ws"; }
  get priority() { return 1; }
  get trustScore() { return 95; }

  async lookup(cnpj) {
    const normalized = this._normalizeCnpj(cnpj);
    const response = await this.protectedFetch(`https://publica.cnpj.ws/cnpj/${normalized}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`CNPJ.ws HTTP ${response.status}`);
    const data = await response.json();
    return this.normalize(this._mapRaw(data, normalized));
  }

  _mapRaw(data, originalCnpj) {
    const est = data.estabelecimento || {};
    const mainCnae = est.atividade_principal || {};
    const uf = est.estado?.sigla || null;
    const regs = est.inscricoes_estaduais || [];
    const reg = regs.find(r => r.ativo !== false && (!uf || r.estado?.sigla === uf)) || regs[0] || null;
    const ieNumber = reg?.inscricao_estadual ? String(reg.inscricao_estadual).replace(/\D/g, "") : null;
    const simples = data.simples || {};
    const opSimples = simples.opcao_pelo_simples === true ? true : simples.opcao_pelo_simples === false ? false : null;
    const opMei = simples.opcao_pelo_mei === true ? true : simples.opcao_pelo_mei === false ? false : null;
    const tipo = est.tipo != null ? Number(est.tipo) : null;
    const porte = this._mapPorte(data.porte);
    const natJur = data.natureza_juridica || {};
    const secundarios = (data.cnaes_secundarios || est.atividades_secundarias || []).map(c => ({
      codigo: String(c.id || "").replace(/\D/g, "") || null,
      descricao: c.descricao || null,
    })).filter(c => c.codigo);

    return {
      cnpj: originalCnpj,
      razaoSocial: data.razao_social || null,
      nomeFantasia: est.nome_fantasia || null,
      logradouro: est.endereco || null,
      numero: est.numero || null,
      complemento: est.complemento || null,
      bairro: est.bairro || null,
      cep: est.cep ? String(est.cep).replace(/\D/g, "") : null,
      cidade: est.cidade?.nome || null,
      uf,
      cnaePrincipal: {
        codigo: String(mainCnae.id || "").replace(/\D/g, "") || null,
        codigoFormatado: mainCnae.subclasse || this._formatCnae(mainCnae.id),
        descricao: mainCnae.descricao || null,
      },
      cnaeSecundarios: secundarios,
      inscricaoMunicipal: est.inscricao_municipal || null,
      telefone: est.telefone1 || null,
      telefone2: est.telefone2 || null,
      email: est.email || null,
      dataAbertura: est.data_inicio_atividade || null,
      situacaoCadastral: this._mapSituacao(est.situacao_cadastral),
      situacaoCadastralData: est.situacao_cadastral_data || null,
      naturezaJuridica: natJur.id && natJur.descricao ? `${natJur.id} - ${natJur.descricao}` : (natJur.descricao || natJur.id || null),
      naturezaJuridicaCodigo: natJur.id || null,
      porte,
      capitalSocial: data.capital_social != null ? String(data.capital_social) : null,
      optanteSimples: opSimples,
      mei: opMei,
      matriz: tipo === 1,
      filial: tipo === 2,
      inscricaoEstadual: ieNumber,
      ieFonte: ieNumber ? "BUSCA_AUTOMATICA" : "NAO_ENCONTRADA",
      qsa: data.qsa || null,
      dataOpcaoSimples: simples.data_opcao_pelo_simples || null,
      dataExclusaoSimples: simples.data_exclusao_pelo_simples || null,
    };
  }
}
