import { BaseProvider } from "./base-provider.js";
import { formatStateRegistration } from "../state-registration-validator.service.js";

export class SintegraProvider extends BaseProvider {
  get name() { return "sintegra_brasilapi"; }
  get priority() { return 10; }
  get trustScore() { return 70; }

  async lookup(cnpj, uf) {
    const normalized = this._normalizeCnpj(cnpj);
    const state = (uf || "").toUpperCase();
    if (!state || state.length !== 2) return null;
    try {
      const response = await this.protectedFetch(
        `https://brasilapi.com.br/api/inscricao_estadual/v1/${state}/${normalized}`,
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`SintegraAPI HTTP ${response.status}`);
      const data = await response.json();
      const ie = data.inscricao_estadual || data.ie || null;
      if (!ie) return null;
      return this.normalize({
        cnpj: normalized,
        inscricaoEstadual: String(ie).replace(/\D/g, "") || null,
        inscricaoEstadualFormatada: formatStateRegistration(ie, state) || ie,
        ieUf: state,
        ieSituacao: data.ativo === false ? "INATIVA" : "ATIVA",
        ieFonte: "SINTEGRA_BRASILAPI",
      });
    } catch {
      return null;
    }
  }
}
