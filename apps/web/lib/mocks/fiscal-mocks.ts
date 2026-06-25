export const fiscalAutopilotMock = {
  summary: {
    totalIssues: 42,
    autoSafeCount: 21,
    needsConfirmationCount: 13,
    needsAccountantCount: 8,
    financialImpact: 72450.00,
    fiscalScore: 82,
    correctionsApplied: 156,
  },
  categories: [
    {
      label: "Correcao automatica segura",
      count: 21,
      type: "AUTO_SAFE" as const,
      items: [
        {
          id: "1",
          code: "IBGE_MISSING",
          title: "Codigos IBGE ausentes",
          description: "9 municipios sem codigo IBGE no cadastro de clientes",
          type: "AUTO_SAFE" as const,
          riskLevel: "LOW" as const,
          status: "OPEN" as const,
          responsible: "SYSTEM" as const,
          financialImpact: 0,
          confidence: 0.98,
          ruleReference: "MOC_NFE v3.10 - Regra 12.3",
          createdAt: "2026-06-20T10:00:00Z",
          updatedAt: "2026-06-20T10:00:00Z",
          autoFixAction: "Preencher IBGE via API de municipios",
          relatedEntityIds: ["client-1", "client-2", "client-3"],
        },
        {
          id: "2",
          code: "XML_DUPLICATE",
          title: "XMLs duplicados",
          description: "4 documentos com mesma chave de acesso importados",
          type: "AUTO_SAFE" as const,
          riskLevel: "LOW" as const,
          status: "OPEN" as const,
          responsible: "SYSTEM" as const,
          financialImpact: 0,
          confidence: 1.0,
          ruleReference: "MOC_NFE v3.10 - Regra 8.1",
          createdAt: "2026-06-19T14:00:00Z",
          updatedAt: "2026-06-19T14:00:00Z",
          autoFixAction: "Remover duplicatas mantendo o XML completo",
          relatedEntityIds: ["doc-1", "doc-2"],
        },
        {
          id: "3",
          code: "TOTAL_DIVERGENT",
          title: "Totais divergentes",
          description: "6 notas com valor total diferente da soma dos itens",
          type: "AUTO_SAFE" as const,
          riskLevel: "MEDIUM" as const,
          status: "OPEN" as const,
          responsible: "SYSTEM" as const,
          financialImpact: 12450.00,
          confidence: 0.95,
          ruleReference: "MOC_NFE v3.10 - Regra 15.2",
          createdAt: "2026-06-18T09:00:00Z",
          updatedAt: "2026-06-18T09:00:00Z",
          autoFixAction: "Recalcular total pela soma dos itens",
          relatedEntityIds: ["doc-3", "doc-4", "doc-5"],
        },
      ],
    },
    {
      label: "Correcao automatica nao segura",
      count: 13,
      type: "AUTO_CONFIRM" as const,
      items: [
        {
          id: "4",
          code: "IE_INDICATOR_MISSING",
          title: "Clientes sem indicador IE",
          description: "3 clientes sem indicador de inscricao estadual",
          type: "AUTO_CONFIRM" as const,
          riskLevel: "LOW" as const,
          status: "OPEN" as const,
          responsible: "SYSTEM" as const,
          financialImpact: 0,
          confidence: 0.92,
          ruleReference: "MOC_NFE v3.10 - Regra 11.4",
          createdAt: "2026-06-20T11:00:00Z",
          updatedAt: "2026-06-20T11:00:00Z",
          autoFixAction: "Definir indicador IE = 9",
          relatedEntityIds: [],
        },
      ],
    },
    {
      label: "Revisao do contador",
      count: 8,
      type: "ACCOUNTANT_REVIEW" as const,
      items: [
        {
          id: "5",
          code: "CST_INVALID",
          title: "CST incompativel com CFOP",
          description: "5 notas com CST 00 e CFOP de saida para consumidor final",
          type: "ACCOUNTANT_REVIEW" as const,
          riskLevel: "HIGH" as const,
          status: "OPEN" as const,
          responsible: "ACCOUNTANT" as const,
          financialImpact: 45000.00,
          confidence: 0.75,
          ruleReference: "MOC_NFE v3.10 - Regra 14.1",
          createdAt: "2026-06-17T16:00:00Z",
          updatedAt: "2026-06-17T16:00:00Z",
          autoFixAction: "Revisar CST e CFOP com contador",
          relatedEntityIds: ["doc-6", "doc-7"],
        },
      ],
    },
  ],
  recentCorrections: [] as Array<{
    id: string;
    action: string;
    entity: string;
    timestamp: string;
    type: string;
    status: string;
  }>,
};

export const fiscalAiMock = {
  quickQuestions: [
    "Por que essa nota rejeitou?",
    "Empresas prontas para fechamento?",
    "Produtos sem NCM?",
    "SPED bloqueado?",
    "Pendencias do cliente?",
    "Reservar imposto?",
  ],
  responses: {} as Record<string, unknown>,
};

export const fiscalScoreMock: import("@/lib/fiscal-types").FiscalScoreData = {
  score: 82,
  riskLevel: "MEDIUM",
  closingScore: 75,
  closingPeriod: "Jun/2026",
  items: [
    { id: "sc-1", label: "XMLs importados", status: "OK", weight: 20, details: "128 de 130 XMLs" },
    { id: "sc-2", label: "Produtos classificados", status: "WARNING", weight: 15, details: "34 de 46 com NCM" },
    { id: "sc-3", label: "Clientes completos", status: "OK", weight: 15, details: "12 de 12" },
    { id: "sc-4", label: "Certificado digital", status: "OK", weight: 20, details: "Valido ate 15/12/2026" },
    { id: "sc-5", label: "SPED em dia", status: "ERROR", weight: 20, details: "3 produtos sem NCM bloqueiam SPED" },
    { id: "sc-6", label: "Rejeicoes pendentes", status: "WARNING", weight: 10, details: "7 rejeicoes abertas" },
  ],
  evolution: [
    { period: "Jan/2026", score: 45 },
    { period: "Fev/2026", score: 52 },
    { period: "Mar/2026", score: 58 },
    { period: "Abr/2026", score: 65 },
    { period: "Mai/2026", score: 74 },
    { period: "Jun/2026", score: 82 },
  ],
  positivePoints: ["Certificado ativo", "XMLs atualizados", "Clientes completos"],
  risks: ["3 produtos sem NCM", "SPED bloqueado"],
  criticalPendencies: ["Preencher NCM dos 3 produtos restantes"],
  recommendedActions: ["Classificar produtos pendentes", "Enviar SPED"],
};

export const stuckMoneyMock: import("@/lib/fiscal-types").StuckMoneyData = {
  totalStuck: 72450,
  byCategory: [
    { label: "Notas rejeitadas", count: 7, amount: 31200, percentage: 43 },
    { label: "SPED bloqueado", count: 3, amount: 25000, percentage: 35 },
    { label: "XMLs sem lancamento", count: 12, amount: 10500, percentage: 14 },
    { label: "Certificado vencido", count: 1, amount: 5750, percentage: 8 },
  ],
  topDocuments: [
    { id: "doc-1", accessKey: "35260612345678000123550010000000011000000001", issuerName: "Gama Tech Ltda.", amount: 15000, daysStuck: 45, reason: "Rejeicao 720 - CST incompativel", action: "Corrigir CST" },
    { id: "doc-2", accessKey: "35260612345678000123550010000000021000000002", issuerName: "Beta Servicos Ltda.", amount: 12000, daysStuck: 30, reason: "SPED bloqueado por NCM faltante", action: "Classificar NCM" },
    { id: "doc-3", accessKey: "35260612345678000123550010000000031000000003", issuerName: "Delta Autopecas Ltda.", amount: 8200, daysStuck: 15, reason: "XML sem lancamento em estoque", action: "Lancar estoque" },
  ],
  recoveryActions: ["Corrigir rejeicoes criticas", "Classificar NCMs pendentes", "Lancar XMLs em estoque", "Renovar certificado digital"],
};

export const fiscalCalendarMock: import("@/lib/fiscal-types").FiscalCalendarItem[] = [
  { id: "cal-1", obligation: "DAS - Simples Nacional", companyId: "comp-1", companyName: "Gama Tech Ltda.", competence: "Jun/2026", estimatedAmount: 8430.90, dueDate: "2026-07-20", status: "DUE_SOON", responsible: "ACCOUNTANT", actions: ["MARK_PAID", "REQUEST_GUIDE", "SEND_ALERT"] },
  { id: "cal-2", obligation: "SPED Fiscal", companyId: "comp-1", companyName: "Gama Tech Ltda.", competence: "Jun/2026", estimatedAmount: 0, dueDate: "2026-07-31", status: "PENDING", responsible: "ACCOUNTANT", actions: ["VIEW_PENDENCY", "SEND_ALERT"] },
  { id: "cal-3", obligation: "ICMS - Guia", companyId: "comp-2", companyName: "Beta Servicos Ltda.", competence: "Jun/2026", estimatedAmount: 2120.40, dueDate: "2026-07-15", status: "OPEN", responsible: "COMPANY", actions: ["MARK_PAID", "ATTACH_PROOF"] },
  { id: "cal-4", obligation: "ISS - Guia", companyId: "comp-2", companyName: "Beta Servicos Ltda.", competence: "Jun/2026", estimatedAmount: 3500, dueDate: "2026-07-10", status: "OVERDUE", responsible: "ACCOUNTANT", actions: ["MARK_PAID", "REQUEST_GUIDE", "SEND_ALERT"] },
  { id: "cal-5", obligation: "DCTF", companyId: "comp-3", companyName: "Delta Autopecas Ltda.", competence: "Jun/2026", estimatedAmount: 0, dueDate: "2026-07-25", status: "PAID", responsible: "ACCOUNTANT", actions: ["ATTACH_PROOF"] },
  { id: "cal-6", obligation: "EFD Contribuicoes", companyId: "comp-1", companyName: "Gama Tech Ltda.", competence: "Jun/2026", estimatedAmount: 0, dueDate: "2026-07-15", status: "WAITING_ACCOUNTANT", responsible: "ACCOUNTANT", actions: ["VIEW_PENDENCY"] },
  { id: "cal-7", obligation: "DAS - Simples Nacional", companyId: "comp-3", companyName: "Delta Autopecas Ltda.", competence: "Jun/2026", estimatedAmount: 6800, dueDate: "2026-07-20", status: "PENDING", responsible: "COMPANY", actions: ["MARK_PAID", "REQUEST_GUIDE", "SEND_ALERT"] },
  { id: "cal-8", obligation: "Guia ICMS", companyId: "comp-1", companyName: "Gama Tech Ltda.", competence: "Jun/2026", estimatedAmount: 1870.30, dueDate: "2026-07-15", status: "DUE_SOON", responsible: "ACCOUNTANT", actions: ["MARK_PAID", "ATTACH_PROOF"] },
];

export const accountantRiskMock: import("@/lib/fiscal-types").AccountantRiskRanking = {
  companies: [
    { id: "comp-1", name: "Gama Tech Ltda.", score: 32, riskLevel: "CRITICAL" as const, mainIssue: "Certificado vencendo + SPED bloqueado", financialImpact: 125000, action: "Renovar certificado + classificar NCMs", trend: "WORSENING" as const, lastEventDate: "2026-06-20T10:00:00Z", actionPlan: [
      { id: "ap-1-1", description: "Renovar certificado digital A1", priority: "CRITICAL" as const, responsible: "ACCOUNTANT" as const, deadline: "2026-07-02", completed: false },
      { id: "ap-1-2", description: "Classificar 3 NCMs pendentes", priority: "HIGH" as const, responsible: "SYSTEM" as const, deadline: "2026-07-15", completed: false },
      { id: "ap-1-3", description: "Entregar SPED Fiscal", priority: "HIGH" as const, responsible: "ACCOUNTANT" as const, deadline: "2026-07-31", completed: false },
    ] },
    { id: "comp-2", name: "Beta Servicos Ltda.", score: 58, riskLevel: "HIGH" as const, mainIssue: "NFS-e sem codigo nacional", financialImpact: 42000, action: "Cadastrar codigo NFS-e nacional", trend: "STABLE" as const, lastEventDate: "2026-06-19T14:00:00Z", actionPlan: [
      { id: "ap-2-1", description: "Cadastrar prestador NFS-e nacional", priority: "HIGH" as const, responsible: "COMPANY" as const, deadline: "2026-07-10", completed: false },
      { id: "ap-2-2", description: "Configurar codigos de servico", priority: "MEDIUM" as const, responsible: "ACCOUNTANT" as const, deadline: "2026-07-20", completed: false },
      { id: "ap-2-3", description: "Configurar retencoes ISS", priority: "MEDIUM" as const, responsible: "ACCOUNTANT" as const, deadline: "2026-07-25", completed: false },
    ] },
    { id: "comp-3", name: "Delta Autopecas Ltda.", score: 71, riskLevel: "MEDIUM" as const, mainIssue: "3 produtos sem NCM", financialImpact: 18700, action: "Classificar NCMs pendentes", trend: "IMPROVING" as const, lastEventDate: "2026-06-18T09:00:00Z", actionPlan: [
      { id: "ap-3-1", description: "Classificar NCMs pendentes", priority: "MEDIUM" as const, responsible: "SYSTEM" as const, deadline: "2026-07-20", completed: false },
      { id: "ap-3-2", description: "Vincular CT-e pendentes", priority: "LOW" as const, responsible: "ACCOUNTANT" as const, deadline: "2026-07-31", completed: false },
    ] },
    { id: "comp-4", name: "Epsilon Comercio Ltda.", score: 85, riskLevel: "LOW" as const, mainIssue: "1 XML duplicado", financialImpact: 0, action: "Remover XML duplicado", trend: "IMPROVING" as const, lastEventDate: "2026-06-17T16:00:00Z", actionPlan: [
      { id: "ap-4-1", description: "Remover XML duplicado", priority: "LOW" as const, responsible: "SYSTEM" as const, deadline: "2026-07-10", completed: false },
    ] },
    { id: "comp-5", name: "Zeta Tech Solutions Ltda.", score: 96, riskLevel: "VERY_LOW" as const, mainIssue: "Nenhuma pendencia critica", financialImpact: 0, action: "Manter conformidade", trend: "STABLE" as const, lastEventDate: "2026-06-15T11:00:00Z", actionPlan: [] },
  ],
  summary: { critical: 1, high: 1, medium: 1, low: 1, veryLow: 1 },
};

export const accountantWorkQueueMock: import("@/lib/fiscal-types").AccountantWorkQueueItem[] = [
  { id: "wq-1", companyId: "comp-1", companyName: "Gama Tech Ltda.", problem: "Certificado digital vence em 8 dias", responsible: "ACCOUNTANT", dueDate: "2026-07-02", financialImpact: 125000, status: "OPEN", column: "CRITICAL", actions: ["ASSIGN_ACCOUNTANT", "REQUEST_CLIENT"] },
  { id: "wq-2", companyId: "comp-1", companyName: "Gama Tech Ltda.", problem: "SPED Fiscal bloqueado por NCM faltante", responsible: "ACCOUNTANT", dueDate: "2026-07-31", financialImpact: 25000, status: "OPEN", column: "HIGH", actions: ["AUTO_FIX", "ASSIGN_ACCOUNTANT"] },
  { id: "wq-3", companyId: "comp-2", companyName: "Beta Servicos Ltda.", problem: "NFS-e sem codigo nacional cadastrado", responsible: "COMPANY", dueDate: "2026-07-15", financialImpact: 42000, status: "OPEN", column: "HIGH", actions: ["REQUEST_CLIENT", "MARK_RESOLVED"] },
  { id: "wq-4", companyId: "comp-3", companyName: "Delta Autopecas Ltda.", problem: "3 produtos sem NCM classificado", responsible: "SYSTEM", dueDate: "2026-07-20", financialImpact: 18700, status: "OPEN", column: "MEDIUM", actions: ["AUTO_FIX", "IGNORE", "MARK_RESOLVED"] },
];

export const clientRequestsMock: import("@/lib/fiscal-types").ClientRequest[] = [
  { id: "req-1", companyId: "comp-1", companyName: "Gama Tech Ltda.", message: "Existem 3 XMLs de entrada pendentes e 2 produtos sem NCM.", channels: ["WHATSAPP", "EMAIL"], status: "SENT", sentAt: "2026-06-20T10:00:00Z", expiresAt: "2026-07-20T10:00:00Z" },
  { id: "req-2", companyId: "comp-2", companyName: "Beta Servicos Ltda.", message: "Certificado digital vence em 8 dias.", channels: ["INTERNAL", "SECURE_LINK"], status: "VIEWED", sentAt: "2026-06-19T14:00:00Z", viewedAt: "2026-06-19T18:00:00Z", expiresAt: "2026-07-19T14:00:00Z" },
];

export const fiscalRadarMock: import("@/lib/fiscal-types").FiscalRadarAlert[] = [
  { id: "rad-1", title: "Certificado digital vencendo", description: "Gama Tech - Certificado A1 vence em 8 dias", riskLevel: "CRITICAL", estimatedImpact: 125000, dueDate: "2026-07-02", category: "CERTIFICATE", actions: ["AUTO_FIX", "SEND_TO_ACCOUNTANT"], createdAt: "2026-06-20T10:00:00Z" },
  { id: "rad-2", title: "SPED bloqueado", description: "3 produtos sem NCM bloqueiam SPED Fiscal de Junho", riskLevel: "HIGH", estimatedImpact: 25000, dueDate: "2026-07-31", category: "SPED", actions: ["APPLY_AI_SUGGESTION", "REQUEST_CLIENT"], createdAt: "2026-06-19T14:00:00Z" },
  { id: "rad-3", title: "NFS-e sem codigo nacional", description: "Beta Servicos - Codigo NFS-e nacional nao cadastrado", riskLevel: "MEDIUM", estimatedImpact: 42000, category: "COMPANY", actions: ["REQUEST_CLIENT", "SEND_TO_ACCOUNTANT"], createdAt: "2026-06-18T09:00:00Z" },
  { id: "rad-4", title: "Produtos sem classificacao", description: "3 produtos de Delta Autopecas sem NCM cadastrado", riskLevel: "LOW", estimatedImpact: 18700, category: "PRODUCT", actions: ["APPLY_AI_SUGGESTION"], createdAt: "2026-06-17T16:00:00Z" },
  { id: "rad-5", title: "Rejeicoes pendentes", description: "7 notas rejeitadas aguardando correcao", riskLevel: "MEDIUM", estimatedImpact: 31200, category: "DOCUMENT", actions: ["AUTO_FIX", "SEND_TO_ACCOUNTANT"], createdAt: "2026-06-16T11:00:00Z" },
];

export const fiscalInboxMock: import("@/lib/fiscal-types").FiscalInboxItem[] = [
  { id: "inbox-1", type: "CERTIFICATE_EXPIRING", priority: "HIGH", companyId: "comp-1", companyName: "Gama Tech Ltda.", problem: "Certificado vencendo", responsible: "COMPANY", dueDate: "2026-07-02", financialImpact: 120000, status: "OPEN", actions: ["ASSIGN_ACCOUNTANT", "REQUEST_CLIENT"] },
  { id: "inbox-2", type: "CTE_UNLINKED", priority: "MEDIUM", companyId: "comp-3", companyName: "Delta Autopecas Ltda.", problem: "CT-e sem vinculo", responsible: "ACCOUNTANT", dueDate: "2026-07-15", financialImpact: 0, status: "IN_PROGRESS", actions: ["AUTO_FIX", "MARK_RESOLVED"] },
  { id: "inbox-3", type: "PRODUCT_NEW", priority: "LOW", companyId: "comp-3", companyName: "Delta Autopecas Ltda.", problem: "3 produtos sem NCM", responsible: "SYSTEM", dueDate: "2026-07-20", financialImpact: 18700, status: "OPEN", actions: ["AUTO_FIX", "IGNORE"] },
];

export const fiscalMaturityMock: import("@/lib/fiscal-types").FiscalMaturityData = {
  currentLevel: "LEVEL_3_REGISTRATIONS_VALIDATED",
  levelName: "Nivel 3 - Cadastros Validados",
  progress: 45,
  requirements: [
    { id: "req-1", description: "Importar todos os XMLs", completed: true, level: "LEVEL_1_MESSY" as const },
    { id: "req-2", description: "Organizar XMLs por competencia", completed: true, level: "LEVEL_2_DOCUMENTS_ORGANIZED" as const },
    { id: "req-3", description: "Validar cadastros de clientes", completed: true, level: "LEVEL_3_REGISTRATIONS_VALIDATED" as const },
    { id: "req-4", description: "Classificar NCMs dos produtos", completed: false, level: "LEVEL_3_REGISTRATIONS_VALIDATED" as const },
    { id: "req-5", description: "Cadastrar codigos IBGE", completed: false, level: "LEVEL_3_REGISTRATIONS_VALIDATED" as const },
    { id: "req-6", description: "Vincular CT-e a NF-e", completed: false, level: "LEVEL_4_FISCAL_STOCK_CONTROLLED" as const },
    { id: "req-7", description: "Controlar estoque fiscal", completed: false, level: "LEVEL_4_FISCAL_STOCK_CONTROLLED" as const },
    { id: "req-8", description: "Configurar fechamento automatico", completed: false, level: "LEVEL_5_AUTO_CLOSING" as const },
    { id: "req-9", description: "Ativar piloto automatico", completed: false, level: "LEVEL_6_FISCAL_AUTOPILOT" as const },
  ],
  nextLevelRequirements: ["Vincular CT-e a NF-e", "Controlar estoque fiscal"],
};

export const nfseNationalMock: import("@/lib/fiscal-types").NfseNationalChecklist[] = [
  { companyId: "comp-1", companyName: "Gama Tech Ltda.", providerRegistered: true, servicesRegistered: 15, nationalCodePending: 3, municipalityPending: 2, retentionsNotConfigured: 1, incompleteTakners: 0, status: "IN_PROGRESS" },
  { companyId: "comp-2", companyName: "Beta Servicos Ltda.", providerRegistered: false, servicesRegistered: 0, nationalCodePending: 8, municipalityPending: 5, retentionsNotConfigured: 4, incompleteTakners: 3, status: "NOT_STARTED" },
];

export const inventoryIncomingMock: import("@/lib/fiscal-types").InventoryIncomingItem[] = [
  { id: "inv-1", documentId: "doc-1", accessKey: "35260612345678000123550010000000011000000001", supplierProductCode: "SKU-001", supplierProductName: "Capa Smartphone iPhone 15", internalProductId: "prod-1", internalProductName: "Capa iPhone 15", ncm: "3926.90.90", cest: "0100100", unit: "UN", quantity: 100, unitPrice: 15.90, totalAmount: 1590.00, isLinked: true, hasDivergence: false, canAutoLaunch: true, status: "LAUNCHED" },
  { id: "inv-2", documentId: "doc-2", accessKey: "35260612345678000123550010000000021000000002", supplierProductCode: "SKU-002", supplierProductName: "Pel\u00edcula Vidro iPhone 15", ncm: "7007.29.00", unit: "UN", quantity: 200, unitPrice: 8.50, totalAmount: 1700.00, isLinked: false, hasDivergence: true, divergenceType: "NCM", canAutoLaunch: false, status: "BLOCKED" },
  { id: "inv-3", documentId: "doc-3", accessKey: "35260612345678000123550010000000031000000003", supplierProductCode: "SKU-003", supplierProductName: "Pneu 195/65R15", ncm: "4011.10.00", unit: "UN", quantity: 4, unitPrice: 350.00, totalAmount: 1400.00, isLinked: false, hasDivergence: false, canAutoLaunch: true, status: "PENDING" },
];

export const rejectionSimulatorMock = {
  rejectionChance: 18,
  risks: [
    { id: "risk-1", label: "Cliente sem IE", severity: "CRITICAL" as const, description: "Destinatario sem inscricao estadual", autoFixAvailable: true, action: "Cadastrar IE ou indicador 9" },
    { id: "risk-2", label: "Produto sem CEST", severity: "HIGH" as const, description: "Item com ST sem CEST", autoFixAvailable: true, action: "Aplicar CEST sugerido" },
    { id: "risk-3", label: "Total ICMS divergente", severity: "HIGH" as const, description: "Diferenca de R$ 45,80", autoFixAvailable: true, action: "Recalcular automaticamente" },
  ],
};
