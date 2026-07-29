import { createHash, randomInt } from "node:crypto";

import { XMLBuilder, XMLParser } from "fast-xml-parser";

import { AppError } from "../../utils/app-error.js";

export const MDFE_LAYOUT_VERSION = "3.00";
export const MDFE_SCHEMA_VERSION = "3.00b-NT2025.001-v1.05";
export const MDFE_MODEL = "58";

export const MDFE_STATUS_TRANSITIONS = Object.freeze({
  DRAFT: ["VALIDATING"],
  VALIDATING: ["VALIDATION_FAILED", "READY_TO_AUTHORIZE", "ERROR"],
  VALIDATION_FAILED: ["VALIDATING", "DRAFT"],
  READY_TO_AUTHORIZE: ["VALIDATING", "SIGNING", "ERROR"],
  SIGNING: ["SIGNED", "ERROR"],
  SIGNED: ["AUTHORIZING", "ERROR"],
  AUTHORIZING: ["AUTHORIZED", "REJECTED", "DENIED", "ERROR"],
  AUTHORIZED: ["IN_TRANSIT", "CANCELLING", "CLOSING", "ERROR"],
  IN_TRANSIT: ["CANCELLING", "CLOSING", "ERROR"],
  REJECTED: ["DRAFT", "VALIDATING"],
  DENIED: [],
  CANCELLING: ["CANCELLED", "AUTHORIZED", "IN_TRANSIT", "ERROR"],
  CANCELLED: [],
  CLOSING: ["CLOSED", "AUTHORIZED", "IN_TRANSIT", "ERROR"],
  CLOSED: [],
  CONTINGENCY: ["AUTHORIZING", "ERROR"],
  ERROR: ["DRAFT", "VALIDATING", "AUTHORIZING"],
});

const UF_CODES = Object.freeze({
  AC: "12",
  AL: "27",
  AP: "16",
  AM: "13",
  BA: "29",
  CE: "23",
  DF: "53",
  ES: "32",
  GO: "52",
  MA: "21",
  MT: "51",
  MS: "50",
  MG: "31",
  PA: "15",
  PB: "25",
  PR: "41",
  PE: "26",
  PI: "22",
  RJ: "33",
  RN: "24",
  RS: "43",
  RO: "11",
  RR: "14",
  SC: "42",
  SP: "35",
  SE: "28",
  TO: "17",
});

const STATUS_SUCCESS = new Set(["100", "101", "107", "132", "135", "136"]);
const STATUS_DENIED = new Set(["110", "301", "302", "303"]);

export function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function normalizeTaxId(value) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function mdfeUfCode(value) {
  return UF_CODES[String(value || "").toUpperCase()] || null;
}

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function calculateModulo11CheckDigit(base) {
  const characters = normalizeTaxId(base);
  if (!characters) throw new AppError("Base inválida.", "MDFE_INVALID_DV_BASE", 400);
  let weight = 2;
  let total = 0;
  for (let index = characters.length - 1; index >= 0; index -= 1) {
    // NT Conjunta CNPJ Alfanumérico: valor do caractere = ASCII - 48.
    total += (characters.charCodeAt(index) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = total % 11;
  return remainder === 0 || remainder === 1 ? "0" : String(11 - remainder);
}

export function generateNumericCode() {
  return String(randomInt(0, 100_000_000)).padStart(8, "0");
}

export function buildMdfeAccessKey({
  uf,
  emissionDate,
  cnpj,
  series,
  number,
  emissionType = "1",
  numericCode,
}) {
  const cUf = UF_CODES[String(uf || "").toUpperCase()];
  const issuerCnpj = normalizeTaxId(cnpj);
  const date = new Date(emissionDate);
  const serie = onlyDigits(series).padStart(3, "0");
  const nMdf = onlyDigits(number).padStart(9, "0");
  const cMdf = onlyDigits(numericCode).padStart(8, "0");
  if (!cUf || !/^[A-Z0-9]{12}\d{2}$/.test(issuerCnpj) || Number.isNaN(date.getTime())) {
    throw new AppError(
      "UF, CNPJ ou data de emissão inválidos para formar a chave do MDF-e.",
      "MDFE_ACCESS_KEY_INPUT_INVALID",
      422,
    );
  }
  if (serie.length !== 3 || nMdf.length !== 9 || cMdf.length !== 8) {
    throw new AppError(
      "Série, número ou código numérico inválidos para formar a chave do MDF-e.",
      "MDFE_ACCESS_KEY_RANGE_INVALID",
      422,
    );
  }
  const year = String(date.getUTCFullYear()).slice(-2);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const base = `${cUf}${year}${month}${issuerCnpj}${MDFE_MODEL}${serie}${nMdf}${onlyDigits(emissionType).slice(0, 1) || "1"}${cMdf}`;
  return `${base}${calculateModulo11CheckDigit(base)}`;
}

export function isValidFiscalAccessKey(value) {
  const key = normalizeTaxId(value);
  return (
    /^[0-9]{6}[A-Z0-9]{12}[0-9]{26}$/.test(key) &&
    calculateModulo11CheckDigit(key.slice(0, 43)) === key[43]
  );
}

export function isValidCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function assertMdfeTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return;
  if (!MDFE_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
    throw new AppError(
      `Transição de ${currentStatus} para ${nextStatus} não permitida.`,
      "MDFE_INVALID_STATUS_TRANSITION",
      409,
    );
  }
}

function issue({
  code,
  category,
  fieldPath,
  title,
  message,
  severity = "BLOCKING",
  correctionType = "MANUAL_GUIDED",
  suggestedAction,
  officialRuleReference = "MOC MDF-e 3.00b / schemas NT 2025.001 v1.05",
}) {
  return {
    code,
    severity,
    category,
    fieldPath,
    title,
    message,
    suggestedAction,
    correctionType,
    officialRuleReference,
  };
}

export function validateMdfe(mdfe, { certificate = null } = {}) {
  const issues = [];
  if (mdfe.model !== MDFE_MODEL) {
    issues.push(issue({
      code: "MDFE_MODEL_58",
      category: "identificação",
      fieldPath: "model",
      title: "Modelo fiscal inválido",
      message: "O MDF-e deve utilizar o modelo 58.",
      correctionType: "AUTO_SAFE",
      suggestedAction: "Restaurar o modelo 58.",
    }));
  }
  if (!onlyDigits(mdfe.series) || !onlyDigits(mdfe.number)) {
    issues.push(issue({
      code: "MDFE_NUMBER_REQUIRED",
      category: "identificação",
      fieldPath: "number",
      title: "Numeração incompleta",
      message: "Série e número devem estar reservados antes da validação.",
      suggestedAction: "Salve o rascunho para reservar a numeração.",
    }));
  }
  if (!mdfe.loadingState || !mdfe.unloadingState || mdfe.loadingState === mdfe.unloadingState) {
    issues.push(issue({
      code: "MDFE_ROUTE_UF_INVALID",
      category: "percurso",
      fieldPath: "unloadingState",
      title: "UF inicial e final incompatíveis",
      message: "Informe UFs distintas para início e término da viagem interestadual.",
      suggestedAction: "Revise a origem, o percurso e o destino.",
    }));
  }
  if (!mdfe.loadingMunicipalities?.length) {
    issues.push(issue({
      code: "MDFE_LOADING_CITY_REQUIRED",
      category: "carregamento",
      fieldPath: "loadingMunicipalities",
      title: "Município de carregamento ausente",
      message: "Informe ao menos um município de carregamento com código IBGE.",
    }));
  }
  if (!mdfe.unloadingCities?.length) {
    issues.push(issue({
      code: "MDFE_UNLOADING_CITY_REQUIRED",
      category: "descarregamento",
      fieldPath: "unloadingCities",
      title: "Município de descarregamento ausente",
      message: "Informe ao menos um município de descarregamento.",
    }));
  }
  if (mdfe.modal === "RODOVIARIO" && !mdfe.vehicle) {
    issues.push(issue({
      code: "MDFE_TRACTION_VEHICLE_REQUIRED",
      category: "veículos",
      fieldPath: "vehicle",
      title: "Veículo de tração ausente",
      message: "O modal rodoviário exige um veículo de tração.",
    }));
  }
  if (mdfe.vehicle && Number(mdfe.vehicle.capacityKg || 0) <= 0) {
    issues.push(issue({
      code: "MDFE_VEHICLE_CAPACITY_REQUIRED",
      category: "veículos",
      fieldPath: "vehicle.capacityKg",
      title: "Capacidade do veículo ausente",
      message: "Informe a capacidade em quilogramas do veículo de tração.",
      severity: "WARNING",
    }));
  }
  if (!mdfe.drivers?.length || !mdfe.drivers.some((driver) => driver.isPrimary)) {
    issues.push(issue({
      code: "MDFE_PRIMARY_DRIVER_REQUIRED",
      category: "condutores",
      fieldPath: "drivers",
      title: "Condutor principal ausente",
      message: "Informe ao menos um condutor e marque o principal.",
    }));
  }
  for (const driver of mdfe.drivers || []) {
    if (!isValidCpf(driver.cpf)) {
      issues.push(issue({
        code: "MDFE_DRIVER_CPF_INVALID",
        category: "condutores",
        fieldPath: `drivers.${driver.id}.cpf`,
        title: "CPF de condutor inválido",
        message: `O CPF informado para ${driver.name || "o condutor"} não é válido.`,
      }));
    }
  }
  if (!mdfe.fiscalDocuments?.length) {
    issues.push(issue({
      code: "MDFE_DOCUMENT_REQUIRED",
      category: "documentos",
      fieldPath: "fiscalDocuments",
      title: "Documento fiscal ausente",
      message: "Vincule ao menos uma NF-e ou CT-e autorizada.",
    }));
  }
  for (const document of mdfe.fiscalDocuments || []) {
    if (!isValidFiscalAccessKey(document.accessKey)) {
      issues.push(issue({
        code: "MDFE_DOCUMENT_KEY_INVALID",
        category: "documentos",
        fieldPath: `fiscalDocuments.${document.id}.accessKey`,
        title: "Chave fiscal inválida",
        message: `A chave ${document.accessKey} não possui estrutura ou dígito verificador válido.`,
      }));
    }
    if (!document.unloadingCityCode) {
      issues.push(issue({
        code: "MDFE_DOCUMENT_UNLOADING_CITY_REQUIRED",
        category: "documentos",
        fieldPath: `fiscalDocuments.${document.id}.unloadingCityCode`,
        title: "Destino do documento ausente",
        message: "Todo documento deve estar associado a um município de descarregamento.",
      }));
    }
  }
  const requiresCiot =
    mdfe.modal === "RODOVIARIO" &&
    mdfe.issuerType === "PRESTADOR_SERVICO_TRANSPORTE" &&
    ["ETC", "TAC", "CTC"].includes(mdfe.carrierType);
  if (requiresCiot && !mdfe.ciots?.length) {
    issues.push(issue({
      code: "MDFE_CIOT_REQUIRED",
      category: "CIOT",
      fieldPath: "ciots",
      title: "CIOT obrigatório ausente",
      message: "A operação rodoviária por conta de terceiros e mediante remuneração exige CIOT.",
      officialRuleReference: "NT MDF-e 2026.001 / Ajuste SINIEF 03/2026",
    }));
  }
  if (!mdfe.insurances?.length) {
    issues.push(issue({
      code: "MDFE_INSURANCE_REQUIRED",
      category: "seguros",
      fieldPath: "insurances",
      title: "Seguro não informado",
      message: "Informe o responsável pelo seguro, a seguradora, a apólice e as averbações aplicáveis.",
    }));
  }
  const calculatedCents = (mdfe.fiscalDocuments || []).reduce(
    (total, document) => total + Math.round(Number(document.documentValue || 0) * 100),
    0,
  );
  if (Math.round(Number(mdfe.totalCargoCents || 0)) !== calculatedCents) {
    issues.push(issue({
      code: "MDFE_TOTAL_CARGO_DIVERGENT",
      category: "totais",
      fieldPath: "totalCargoCents",
      title: "Valor total da carga divergente",
      message: "O total persistido não corresponde à soma dos documentos vinculados.",
      correctionType: "AUTO_SAFE",
      suggestedAction: "Recalcular os totais a partir dos documentos.",
    }));
  }
  if (!certificate?.valid) {
    issues.push(issue({
      code: "MDFE_CERTIFICATE_INVALID",
      category: "certificado",
      fieldPath: "certificate",
      title: "Certificado A1 indisponível",
      message: "Cadastre um certificado A1 válido e compatível com o CNPJ da empresa.",
    }));
  }
  return {
    valid: !issues.some((item) => item.severity === "BLOCKING"),
    issues,
    blockingIssuesCount: issues.filter((item) => item.severity === "BLOCKING").length,
    warningIssuesCount: issues.filter((item) => item.severity === "WARNING").length,
  };
}

function formatDateTime(value) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date).replace(" ", "T");
  return `${parts}-03:00`;
}

function decimal(value, places = 2) {
  return Number(value || 0).toFixed(places);
}

function mdfeEnvironment(environment) {
  return String(environment).toLowerCase() === "production" ? "1" : "2";
}

function issuerTypeCode(value) {
  return value === "TRANSPORTADOR_CARGA_PROPRIA" ? "2" : "1";
}

function modalCode(value) {
  const codes = { RODOVIARIO: "1", AEREO: "2", AQUAVIARIO: "3", FERROVIARIO: "4" };
  return codes[value] || "1";
}

function vehicleNode(vehicle) {
  if (!vehicle) return undefined;
  const node = {
    cInt: vehicle.id.slice(0, 10),
    placa: vehicle.plate,
    RENAVAM: vehicle.renavam || undefined,
    tara: Math.round(Number(vehicle.tareWeight || 0)),
    capKG: vehicle.capacityKg ? Math.round(Number(vehicle.capacityKg)) : undefined,
    capM3: vehicle.capacityM3 ? Math.round(Number(vehicle.capacityM3)) : undefined,
    tpRod: vehicle.wheelType || "06",
    tpCar: vehicle.bodyType || "00",
    UF: vehicle.plateState || undefined,
  };
  if (vehicle.ownerCpfCnpj) {
    const taxId = onlyDigits(vehicle.ownerCpfCnpj);
    node.prop = {
      ...(taxId.length === 11 ? { CPF: taxId } : { CNPJ: taxId }),
      RNTRC: vehicle.rntrc || undefined,
      xNome: vehicle.ownerName || undefined,
      IE: vehicle.ownerStateRegistration || undefined,
      UF: vehicle.plateState || undefined,
      tpProp: vehicle.ownerType || "0",
    };
  }
  return node;
}

function documentGroups(mdfe) {
  return (mdfe.unloadingCities || []).map((city) => {
    const documents = (mdfe.fiscalDocuments || []).filter(
      (document) => document.unloadingCityCode === city.cityCode,
    );
    return {
      cMunDescarga: city.cityCode,
      xMunDescarga: city.cityName,
      infNFe: documents
        .filter((document) => document.documentType === "NFE")
        .map((document) => ({ chNFe: document.accessKey })),
      infCTe: documents
        .filter((document) => document.documentType === "CTE")
        .map((document) => ({ chCTe: document.accessKey })),
    };
  });
}

export function buildMdfeXml(mdfe, company) {
  if (!mdfe.accessKey) {
    throw new AppError("Chave do MDF-e ainda não foi gerada.", "MDFE_ACCESS_KEY_REQUIRED", 409);
  }
  const issuerCnpj = normalizeTaxId(company.cnpj);
  const address = company.address || {};
  const requiredAddress = [
    address.street,
    address.number,
    address.district,
    address.cityCode,
    address.city,
    address.uf,
  ];
  if (requiredAddress.some((value) => !String(value || "").trim())) {
    throw new AppError(
      "O endereço fiscal do emitente está incompleto para gerar o MDF-e.",
      "MDFE_ISSUER_ADDRESS_INCOMPLETE",
      422,
    );
  }
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: false,
    suppressEmptyNode: true,
  });
  const road = mdfe.modal === "RODOVIARIO"
    ? {
        infANTT: {
          RNTRC: mdfe.vehicle?.rntrc || undefined,
          infCIOT: (mdfe.ciots || []).map((ciot) => ({
            CIOT: ciot.number,
            ...(onlyDigits(ciot.responsibleTaxId).length === 11
              ? { CPF: onlyDigits(ciot.responsibleTaxId) }
              : { CNPJ: normalizeTaxId(ciot.responsibleTaxId) }),
          })),
          infContratante: (mdfe.contractors || []).map((contractor) => ({
            ...(onlyDigits(contractor.taxId).length === 11
              ? { CPF: onlyDigits(contractor.taxId) }
              : { CNPJ: normalizeTaxId(contractor.taxId) }),
          })),
          valePed: (mdfe.tollVouchers || []).map((voucher) => ({
            disp: {
              CNPJForn: onlyDigits(voucher.providerCnpj),
              nCompra: voucher.purchaseNumber,
              vValePed: decimal(Number(voucher.amountCents) / 100),
            },
          })),
        },
        veicTracao: {
          ...vehicleNode(mdfe.vehicle),
          condutor: (mdfe.drivers || []).map((driver) => ({
            xNome: driver.name,
            CPF: onlyDigits(driver.cpf),
          })),
        },
        reboque: (mdfe.trailers || []).map(vehicleNode),
      }
    : undefined;
  const documentCount = (mdfe.fiscalDocuments || []).reduce(
    (result, document) => ({
      nfe: result.nfe + (document.documentType === "NFE" ? 1 : 0),
      cte: result.cte + (document.documentType === "CTE" ? 1 : 0),
    }),
    { nfe: 0, cte: 0 },
  );
  const payload = {
    MDFe: {
      "@_xmlns": "http://www.portalfiscal.inf.br/mdfe",
      infMDFe: {
        "@_Id": `MDFe${mdfe.accessKey}`,
        "@_versao": MDFE_LAYOUT_VERSION,
        ide: {
          cUF: UF_CODES[mdfe.loadingState],
          tpAmb: mdfeEnvironment(mdfe.environment),
          tpEmit: issuerTypeCode(mdfe.issuerType),
          mod: MDFE_MODEL,
          serie: Number(mdfe.series),
          nMDF: Number(mdfe.number),
          cMDF: mdfe.numericCode,
          cDV: mdfe.checkDigit,
          modal: modalCode(mdfe.modal),
          dhEmi: formatDateTime(mdfe.emissionDate || mdfe.createdAt),
          tpEmis: mdfe.emissionType === "NORMAL" ? "1" : mdfe.emissionType,
          procEmi: "0",
          verProc: mdfe.processVersion,
          UFIni: mdfe.loadingState,
          UFFim: mdfe.unloadingState,
          infMunCarrega: (mdfe.loadingMunicipalities || []).map((city) => ({
            cMunCarrega: city.cityCode,
            xMunCarrega: city.cityName,
          })),
          infPercurso: (mdfe.routeStates || []).map((state) => ({ UFPer: state.stateCode })),
          dhIniViagem: mdfe.tripStartAt ? formatDateTime(mdfe.tripStartAt) : undefined,
          indCarregaPosterior: mdfe.loadingAfter ? "1" : undefined,
        },
        emit: {
          CNPJ: issuerCnpj,
          IE: onlyDigits(company.stateRegistration),
          xNome: company.legalName,
          xFant: company.tradeName || undefined,
          enderEmit: {
            xLgr: address.street,
            nro: address.number,
            xCpl: address.complement || undefined,
            xBairro: address.district,
            cMun: address.cityCode,
            xMun: address.city,
            CEP: onlyDigits(address.cep) || undefined,
            UF: address.uf,
            fone: onlyDigits(address.phone) || undefined,
          },
        },
        infModal: {
          "@_versaoModal": MDFE_LAYOUT_VERSION,
          rodo: road,
        },
        infDoc: {
          infMunDescarga: documentGroups(mdfe),
        },
        seg: (mdfe.insurances || []).map((insurance) => ({
          infResp: {
            respSeg: insurance.responsibleType === "EMITENTE" ? "1" : "2",
            ...(onlyDigits(insurance.responsibleCpfCnpj).length === 11
              ? { CPF: onlyDigits(insurance.responsibleCpfCnpj) }
              : insurance.responsibleCpfCnpj
                ? { CNPJ: normalizeTaxId(insurance.responsibleCpfCnpj) }
                : {}),
          },
          infSeg: {
            xSeg: insurance.insurerName,
            CNPJ: normalizeTaxId(insurance.insurerCnpj),
          },
          nApol: insurance.policyNumber,
          nAver: (insurance.endorsements || []).map((item) => item.endorsementNumber),
        })),
        prodPred: mdfe.predominantProduct
          ? {
              tpCarga: mdfe.predominantCargoType || "05",
              xProd: mdfe.predominantProduct,
              NCM: mdfe.predominantNcm || undefined,
              infLotacao: mdfe.loadingCep && mdfe.unloadingCep
                ? {
                    infLocalCarrega: { CEP: mdfe.loadingCep },
                    infLocalDescarrega: { CEP: mdfe.unloadingCep },
                  }
                : undefined,
            }
          : undefined,
        tot: {
          qCTe: documentCount.cte || undefined,
          qNFe: documentCount.nfe || undefined,
          vCarga: decimal(Number(mdfe.totalCargoCents || 0) / 100),
          cUnid: mdfe.cargoUnit,
          qCarga: decimal(mdfe.cargoQuantity || mdfe.totalWeightKg, 4),
        },
        lacres: (mdfe.seals || []).map((seal) => ({ nLacre: seal.number })),
        infAdic: mdfe.fiscalInfo || mdfe.additionalInfo
          ? {
              infAdFisco: mdfe.fiscalInfo || undefined,
              infCpl: mdfe.additionalInfo || undefined,
            }
          : undefined,
      },
    },
  };
  return `<?xml version="1.0" encoding="UTF-8"?>${builder.build(payload)}`;
}

export function buildSoapEnvelope(messageNode, messageXml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <${messageNode} xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/${messageNode}">
      <mdfeDadosMsg>${messageXml}</mdfeDadosMsg>
    </${messageNode}>
  </soap12:Body>
</soap12:Envelope>`;
}

function findFirstByName(value, names) {
  if (!value || typeof value !== "object") return undefined;
  for (const [key, child] of Object.entries(value)) {
    const local = key.includes(":") ? key.split(":").pop() : key;
    if (names.includes(local)) return child;
    const nested = findFirstByName(child, names);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

export function parseMdfeResponse(xml) {
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    trimValues: true,
  }).parse(xml);
  const result = findFirstByName(parsed, [
    "retMDFe",
    "retConsSitMDFe",
    "retConsStatServMDFe",
    "retEventoMDFe",
    "retConsMDFeNaoEnc",
  ]) || parsed;
  const statusCode = String(findFirstByName(result, ["cStat"]) || "");
  const reason = String(findFirstByName(result, ["xMotivo"]) || "");
  const protocol = findFirstByName(result, ["nProt"]);
  return {
    success: STATUS_SUCCESS.has(statusCode),
    denied: STATUS_DENIED.has(statusCode),
    statusCode,
    reason,
    protocol: protocol ? String(protocol) : null,
    receivedAt: findFirstByName(result, ["dhRecbto"]) || null,
    raw: result,
  };
}
