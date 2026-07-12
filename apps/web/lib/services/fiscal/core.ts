import type {
  FiscalCalculationLine,
  FiscalCalculationSummary,
  FiscalModuleKey,
  FiscalValidationIssue,
  FiscalValidationResult,
} from "@/lib/fiscal-types";

import type { FiscalDocument } from "./types";

function normalizeDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeAmount(value: unknown) {
  const parsed = Number(String(value ?? "0").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function pushIssue(
  issues: FiscalValidationIssue[],
  issue: Omit<FiscalValidationIssue, "module"> & { module?: FiscalModuleKey },
) {
  issues.push({
    module: issue.module ?? "fiscal",
    ...issue,
  });
}

export function inferFiscalModule(document: Partial<FiscalDocument>): FiscalModuleKey {
  const model = String(document.model ?? "").trim();
  const documentType = String(document.documentType ?? "").toUpperCase();

  if (model === "65") return "nfce";
  if (model === "57" || documentType === "CTE") return "cte";
  if (documentType === "NFSE") return "nfse";
  return "nfe";
}

export function buildFiscalDraftValidationIssues(
  document: Partial<FiscalDocument>,
  module = inferFiscalModule(document),
): FiscalValidationIssue[] {
  const issues: FiscalValidationIssue[] = [];
  const accessKey = normalizeDigits(document.accessKey);
  const invoiceNumber = String(document.invoiceNumber ?? "").trim();
  const series = String(document.series ?? "").trim();
  const emissionDate = String(document.emissionDate ?? "").trim();
  const issuerName = String(document.issuerName ?? "").trim();
  const issuerCnpj = normalizeDigits(document.issuerCnpj);
  const recipientName = String(document.recipientName ?? "").trim();
  const recipientCnpj = normalizeDigits(document.recipientCnpj);
  const totalAmount = normalizeAmount(document.totalAmount);

  if (module !== "nfse") {
    if (!accessKey) {
      pushIssue(issues, {
        code: "FISCAL-ACCESS-001",
        field: "accessKey",
        message: "A chave de acesso ainda nao foi informada.",
        impact: "Sem chave, a nota nao pode ser vinculada nem transmitida com seguranca.",
        suggestion: "Preencha a chave de 44 digitos antes da transmissao.",
        severity: "error",
        autoFixAvailable: false,
        ruleReference: "MOC 4.00",
      });
    } else if (accessKey.length !== 44) {
      pushIssue(issues, {
        code: "FISCAL-ACCESS-002",
        field: "accessKey",
        message: `A chave de acesso possui ${accessKey.length} digitos.`,
        impact: "Chaves com tamanho incorreto costumam gerar rejeicao SEFAZ.",
        suggestion: "Revisar a sequencia numerica e completar os 44 digitos exigidos.",
        severity: "critical",
        autoFixAvailable: false,
        ruleReference: "MOC 4.00",
      });
    }
  } else if (accessKey && accessKey.length < 12) {
    pushIssue(issues, {
      code: "FISCAL-NFSE-ACCESS-001",
      field: "accessKey",
      message: "A identificacao do RPS/NFS-e esta muito curta.",
      impact: "O documento precisa de identificacao rastreavel para auditoria e conciliacao.",
      suggestion: "Use uma chave ou identificador mais completo para a NFS-e.",
      severity: "warning",
      autoFixAvailable: false,
      ruleReference: "LC 116/2003",
    });
  }

  if (!invoiceNumber) {
    pushIssue(issues, {
      code: "FISCAL-INVOICE-001",
      field: "invoiceNumber",
      message: "O numero do documento nao foi preenchido.",
      impact: "A rastreabilidade e a sequencia fiscal ficam incompletas.",
      suggestion: "Informe o numero antes de validar a documentacao.",
      severity: "warning",
      autoFixAvailable: false,
      ruleReference: "MOC 4.00",
    });
  }

  if (!series && module !== "nfse") {
    pushIssue(issues, {
      code: "FISCAL-SERIES-001",
      field: "series",
      message: "A serie do documento nao foi informada.",
      impact: "Sem serie, a sequencia fiscal fica ambigua.",
      suggestion: "Defina a serie fiscal padrao da empresa.",
      severity: "warning",
      autoFixAvailable: true,
      autoFixValue: "1",
      ruleReference: "MOC 4.00",
    });
  }

  if (!emissionDate) {
    pushIssue(issues, {
      code: "FISCAL-DATE-001",
      field: "emissionDate",
      message: "A data de emissao nao foi informada.",
      impact: "A validacao fiscal e o fechamento mensal dependem desta data.",
      suggestion: "Preencha a data de emissao ou salve o rascunho para revisar depois.",
      severity: "warning",
      autoFixAvailable: false,
      ruleReference: module === "nfse" ? "LC 116/2003" : "MOC 4.00",
    });
  }

  if (!issuerName) {
    pushIssue(issues, {
      code: "FISCAL-ISSUER-001",
      field: "issuerName",
      message: "O emitente ainda nao foi identificado.",
      impact: "A nota nao pode ser conferida nem relacionada ao cadastro correto.",
      suggestion: "Vincule a empresa emitente antes de seguir com o fluxo.",
      severity: "error",
      autoFixAvailable: false,
      ruleReference: "Cadastro da empresa",
    });
  }

  if (!issuerCnpj && module !== "nfse") {
    pushIssue(issues, {
      code: "FISCAL-ISSUER-002",
      field: "issuerCnpj",
      message: "O CNPJ do emitente nao foi informado.",
      impact: "Sem CNPJ o documento nao pode ser validado com confianca.",
      suggestion: "Vincule o emitente ao cadastro da empresa.",
      severity: "error",
      autoFixAvailable: false,
      ruleReference: "MOC 4.00",
    });
  }

  if (!recipientName && module !== "nfse") {
    pushIssue(issues, {
      code: "FISCAL-RECIPIENT-001",
      field: "recipientName",
      message: "O destinatario ainda nao foi informado.",
      impact: "A destinacao fiscal e a conciliacao financeira ficam incompletas.",
      suggestion: "Vincule o cliente ou fornecedor correspondente.",
      severity: "warning",
      autoFixAvailable: false,
      ruleReference: "MOC 4.00",
    });
  }

  if (!recipientCnpj && module === "nfe") {
    pushIssue(issues, {
      code: "FISCAL-RECIPIENT-002",
      field: "recipientCnpj",
      message: "O CNPJ do destinatario da NF-e nao foi informado.",
      impact: "NF-e de saida precisam de destinatario rastreavel para transmissao segura.",
      suggestion: "Selecione o cliente cadastrado ou preencha o CNPJ corretamente.",
      severity: "warning",
      autoFixAvailable: false,
      ruleReference: "MOC 4.00",
    });
  }

  if (totalAmount <= 0) {
    pushIssue(issues, {
      code: "FISCAL-TOTAL-001",
      field: "totalAmount",
      message: "O valor total precisa ser maior que zero.",
      impact: "Notas zeradas ou negativas costumam interromper a transmissao.",
      suggestion: "Revise itens, descontos e totais antes de validar.",
      severity: "critical",
      autoFixAvailable: false,
      ruleReference: module === "nfse" ? "LC 116/2003" : "MOC 4.00",
    });
  }

  if (document.model && module !== "fiscal") {
    const expectedModel =
      module === "nfce" ? "65" : module === "cte" ? "57" : module === "nfse" ? "NFSE" : "55";
    if (String(document.model) !== expectedModel) {
      pushIssue(issues, {
        code: "FISCAL-MODEL-001",
        field: "model",
        message: `O modelo informado (${document.model}) nao corresponde ao fluxo ${module.toUpperCase()}.`,
        impact: "Modelos incorretos geram rejeicoes ou rotas fiscais equivocadas.",
        suggestion: `Ajuste para o modelo ${expectedModel} antes de transmitir.`,
        severity: "warning",
        autoFixAvailable: false,
        ruleReference: "Cadastro fiscal",
      });
    }
  }

  return issues;
}

export function createFiscalValidationResult(
  issues: FiscalValidationIssue[] = [],
): FiscalValidationResult {
  const score = issues.reduce((currentScore, issue) => {
    const penalty =
      issue.severity === "critical"
        ? 30
        : issue.severity === "error"
          ? 18
          : issue.severity === "warning"
            ? 7
            : 2;
    return Math.max(0, currentScore - penalty);
  }, 100);

  return {
    valid: !issues.some((issue) => issue.severity === "error" || issue.severity === "critical"),
    score,
    issues,
    autoFixApplied: issues.filter((issue) => issue.autoFixAvailable).length,
    checkedAt: new Date().toISOString(),
  };
}

export function validateFiscalDraft(
  document: Partial<FiscalDocument>,
  module = inferFiscalModule(document),
): FiscalValidationResult {
  return createFiscalValidationResult(buildFiscalDraftValidationIssues(document, module));
}

export function calculateFiscalTotals(
  lines: FiscalCalculationLine[],
): FiscalCalculationSummary {
  const summary = lines.reduce(
    (accumulator, line) => {
      const grossAmount = normalizeAmount(line.grossAmount);
      const discountAmount = normalizeAmount(line.discountAmount);
      const taxAmount = normalizeAmount(line.taxAmount);
      accumulator.grossAmount += grossAmount;
      accumulator.discountAmount += discountAmount;
      accumulator.taxAmount += taxAmount;
      return accumulator;
    },
    {
      grossAmount: 0,
      discountAmount: 0,
      taxAmount: 0,
      lines: lines.map((line) => ({
        label: line.label,
        grossAmount: roundMoney(normalizeAmount(line.grossAmount)),
        discountAmount: roundMoney(normalizeAmount(line.discountAmount)),
        taxAmount: roundMoney(normalizeAmount(line.taxAmount)),
      })),
    },
  );

  const netAmount = summary.grossAmount - summary.discountAmount + summary.taxAmount;

  return {
    grossAmount: roundMoney(summary.grossAmount),
    discountAmount: roundMoney(summary.discountAmount),
    taxAmount: roundMoney(summary.taxAmount),
    netAmount: roundMoney(netAmount),
    lines: summary.lines,
  };
}
