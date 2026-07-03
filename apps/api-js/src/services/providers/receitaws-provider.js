import { BaseProvider } from "./base-provider.js";

export class ReceitawsProvider extends BaseProvider {
  get name() { return "receitaws"; }
  get priority() { return 3; }
  get trustScore() { return 90; }

  async lookup(cnpj) {
    const normalized = this._normalizeCnpj(cnpj);
    const response = await this.protectedFetch(
      `https://receitaws.com.br/v1/cnpj/${normalized}`,
      12_000,
      { Accept: "application/json" },
    );
    if (response.status === 404 || response.status === 429) return null;
    if (!response.ok) throw new Error(`ReceitaWS HTTP ${response.status}`);
    const data = await response.json();
    if (data.status === "ERROR") return null;
    return this.normalize(this._mapRaw(data, normalized));
  }

  _mapRaw(data, cnpj) {
    const uf = data.uf || null;
    const natJurStr = data.natureza_juridica || "";
    const natJurCodigo = natJurStr.includes(" - ") ? natJurStr.split(" - ")[0].trim() : null;
    const cepDigits = data.cep ? String(data.cep).replace(/\D/g, "") : null;
    const telefone1 = data.telefone ? String(data.telefone).replace(/\D/g, "") : null;
    const telefone2 = data.telefone2 ? String(data.telefone2).replace(/\D/g, "") : null;
    const cnaeStr = data.cnae_fiscal || "";
    const cnaeMatch = cnaeStr.match(/(\d{4}-\d\/\d{2})/);
    const cnaeDigits = cnaeMatch ? cnaeMatch[1].replace(/\D/g, "") : String(data.cnae_fiscal || "").replace(/\D/g, "");
    const cnaeDesc = cnaeStr.includes(" - ") ? cnaeStr.split(" - ").slice(1).join(" - ").trim() : null;
    const situacao = data.situacao === "ATIVA" ? "ATIVA" : data.situacao === "BAIXADA" ? "BAIXADA" : data.situacao === "SUSPENSA" ? "SUSPENSA" : data.situacao || null;
    const opSimples = data.opcao_pelo_simples === "Sim" ? true : data.opcao_pelo_simples === "Não" ? false : null;
    const opMei = data.opcao_pelo_mei === "Sim" ? true : data.opcao_pelo_mei === "Não" ? false : null;

    let qsa = null;
    if (data.qsa && Array.isArray(data.qsa) && data.qsa.length > 0) {
      qsa = data.qsa.map(s => ({
        nome: s.nome || null,
        qual: s.qual || null,
        paisOrigem: s.pais_origem || null,
        nomeRepLegal: s.nome_rep_legal || null,
        qualRepLegal: s.qual_rep_legal || null,
      }));
    }

    return {
      cnpj,
      razaoSocial: data.nome || null,
      nomeFantasia: data.fantasia || null,
      logradouro: data.logradouro || null,
      numero: data.numero || null,
      complemento: data.complemento || null,
      bairro: data.bairro || null,
      cep: cepDigits,
      cidade: data.municipio || null,
      uf,
      cnaePrincipal: {
        codigo: cnaeDigits || null,
        codigoFormatado: cnaeMatch ? cnaeMatch[1] : this._formatCnae(cnaeDigits),
        descricao: cnaeDesc,
      },
      cnaeSecundarios: (data.atividades_secundarias || []).map(a => {
        const m = (a.code || a.text || "").match(/(\d{4}-\d\/\d{2})/);
        const d = m ? m[1].replace(/\D/g, "") : String(a.code || "").replace(/\D/g, "");
        const desc = (a.text || "").includes(" - ") ? a.text.split(" - ").slice(1).join(" - ").trim() : (a.text || null);
        return { codigo: d || null, descricao: desc };
      }).filter(a => a.codigo),
      telefone: telefone1,
      telefone2,
      email: data.email || null,
      dataAbertura: data.abertura || null,
      situacaoCadastral: situacao,
      situacaoCadastralData: data.data_situacao || null,
      naturezaJuridica: natJurStr || null,
      naturezaJuridicaCodigo: natJurCodigo,
      porte: data.porte || null,
      capitalSocial: data.capital_social ? String(data.capital_social) : null,
      optanteSimples: opSimples,
      mei: opMei,
      inscricaoEstadual: data.inscricao_estadual ? String(data.inscricao_estadual).replace(/\D/g, "") : null,
      ieFonte: data.inscricao_estadual ? "BUSCA_AUTOMATICA" : "NAO_ENCONTRADA",
      inscricaoMunicipal: data.inscricao_municipal ? String(data.inscricao_municipal).replace(/\D/g, "") : null,
      qsa,
    };
  }
}
