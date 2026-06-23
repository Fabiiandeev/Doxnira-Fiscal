import { isValidCnpj } from "../../utils/cnpj.js";
import { isValidCpf } from "../../utils/cpf.js";

export function validarClienteParaEmissao(cliente = {}) {
  const erros = [];
  const alertas = [];
  const sugestoesCorrecao = [];

  const tipo = (cliente.tipoPessoa || "").toUpperCase();

  if (tipo === "PJ") {
    if (!cliente.cnpj || !isValidCnpj(String(cliente.cnpj))) {
      erros.push({
        campo: "cnpj",
        problema: "CNPJ inválido.",
        impacto: "Impossível emitir NF-e sem CNPJ válido.",
        correcaoSugerida: "Verifique e corrija o CNPJ.",
        acoes: ["Editar cadastro"],
      });
    }

    if (!cliente.razaoSocial) {
      erros.push({ campo: "razaoSocial", problema: "Razão Social ausente.", impacto: "Dados cadastrais incompletos.", correcaoSugerida: "Preencha a Razão Social.", acoes: ["Editar cadastro"] });
    }

    if (!cliente.uf || !cliente.cidade) {
      erros.push({ campo: "endereco", problema: "Endereço incompleto.", impacto: "Emissão pode ser rejeitada.", correcaoSugerida: "Preencha UF e cidade.", acoes: ["Editar cadastro"] });
    }

    if (!cliente.inscricaoEstadual) {
      alertas.push({ campo: "inscricaoEstadual", problema: "Inscrição Estadual ausente.", impacto: "A NF-e pode ser rejeitada dependendo da operação e da UF.", correcaoSugerida: "Consulte a IE automaticamente ou preencha manualmente.", acoes: ["Buscar IE", "Editar cadastro"] });
    }

    if (!cliente.regimeTributario) {
      alertas.push({ campo: "regimeTributario", problema: "Regime tributário não informado.", impacto: "Cálculos fiscais podem ficar incorretos.", correcaoSugerida: "Informe o regime tributário.", acoes: ["Editar cadastro"] });
    }

    if (!cliente.cnae) {
      alertas.push({ campo: "cnae", problema: "CNAE não informado.", impacto: "Classificação fiscal incompleta.", correcaoSugerida: "Informe o CNAE principal.", acoes: ["Editar cadastro"] });
    }
  }

  if (tipo === "PF") {
    if (!cliente.cpf || !isValidCpf(String(cliente.cpf))) {
      erros.push({ campo: "cpf", problema: "CPF inválido.", impacto: "Impossível emitir documento fiscal.", correcaoSugerida: "Verifique o CPF.", acoes: ["Editar cadastro"] });
    }

    if (!cliente.nome) {
      erros.push({ campo: "nome", problema: "Nome completo ausente.", impacto: "Dados pessoais incompletos.", correcaoSugerida: "Preencha o nome completo.", acoes: ["Editar cadastro"] });
    }

    if (!cliente.cep || !cliente.logradouro) {
      alertas.push({ campo: "endereco", problema: "Endereço incompleto.", impacto: "Pode impedir emissão de NFS-e.", correcaoSugerida: "Complete o endereço.", acoes: ["Editar cadastro"] });
    }
  }

  // Common checks
  if (!cliente.email) {
    alertas.push({ campo: "email", problema: "Email ausente.", impacto: "Contato do cliente não disponível.", correcaoSugerida: "Informe um email.", acoes: ["Editar cadastro"] });
  }

  if (!cliente.telefone) {
    alertas.push({ campo: "telefone", problema: "Telefone ausente.", impacto: "Contato do cliente não disponível.", correcaoSugerida: "Informe um telefone.", acoes: ["Editar cadastro"] });
  }

  const podeEmitir = erros.length === 0;

  return {
    podeEmitir,
    erros,
    alertas,
    sugestoesCorrecao,
  };
}
