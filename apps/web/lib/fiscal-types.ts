export type CorrectionType =
  | "AUTO_SAFE"
  | "AUTO_CONFIRM"
  | "MANUAL_GUIDED"
  | "ACCOUNTANT_REVIEW"
  | "RETRY_ONLY";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type FiscalIssueStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_CLIENT"
  | "WAITING_ACCOUNTANT"
  | "AUTO_FIXED"
  | "RESOLVED"
  | "IGNORED";

export type FiscalResponsible =
  | "COMPANY"
  | "ACCOUNTANT"
  | "SYSTEM"
  | "FISCAL_AI"
  | "SUPPORT";

export type FiscalMaturityLevel =
  | "LEVEL_1_MESSY"
  | "LEVEL_2_DOCUMENTS_ORGANIZED"
  | "LEVEL_3_REGISTRATIONS_VALIDATED"
  | "LEVEL_4_FISCAL_STOCK_CONTROLLED"
  | "LEVEL_5_AUTO_CLOSING"
  | "LEVEL_6_FISCAL_AUTOPILOT";

export type RequestStatus = "SENT" | "VIEWED" | "ANSWERED" | "RESOLVED" | "EXPIRED";

export type FiscalRuleSource =
  | "MOC_NFE"
  | "MOC_CTE"
  | "NFSE_NACIONAL"
  | "SPED_ICMS_IPI"
  | "SINTEGRA"
  | "TAX_REFORM"
  | "INTERNAL_RULE"
  | "ACCOUNTANT_RULE";

export interface FiscalAutopilotSummary {
  totalIssues: number;
  autoSafeCount: number;
  needsConfirmationCount: number;
  needsAccountantCount: number;
  financialImpact: number;
  fiscalScore: number;
  correctionsApplied: number;
}

export interface FiscalAutopilotCategory {
  label: string;
  count: number;
  items: FiscalIssue[];
  type: CorrectionType;
}

export interface FiscalIssue {
  id: string;
  code: string;
  title: string;
  description: string;
  type: CorrectionType;
  riskLevel: RiskLevel;
  status: FiscalIssueStatus;
  responsible: FiscalResponsible;
  financialImpact: number;
  confidence?: number;
  ruleReference?: string;
  createdAt: string;
  updatedAt?: string;
  autoFixAction?: string;
  relatedEntityIds?: string[];
}

export interface FiscalAiResponse {
  answer: string;
  suggestions: FiscalAiSuggestion[];
  actions: FiscalAiAction[];
  confidence: number;
  sources: string[];
}

export interface FiscalAiSuggestion {
  id: string;
  entityType: "product" | "client" | "document" | "tax" | "stock";
  entityId: string;
  field: string;
  currentValue: string | null;
  suggestedValue: string;
  confidence: number;
  ruleReference: string;
  ruleSource: FiscalRuleSource;
  financialImpact: number;
  type: CorrectionType;
}

export interface FiscalAiAction {
  label: string;
  action: "apply_all" | "apply_selected" | "send_to_accountant" | "view_details" | "ignore";
  count: number;
  type: CorrectionType;
}

export interface FiscalScoreData {
  score: number;
  riskLevel: RiskLevel;
  closingScore: number;
  closingPeriod: string;
  items: FiscalScoreItem[];
  evolution: FiscalScoreEvolution[];
  positivePoints: string[];
  risks: string[];
  criticalPendencies: string[];
  recommendedActions: string[];
}

export interface FiscalScoreItem {
  id: string;
  label: string;
  status: "OK" | "WARNING" | "ERROR";
  weight: number;
  details?: string;
}

export interface FiscalScoreEvolution {
  period: string;
  score: number;
}

export interface StuckMoneyData {
  totalStuck: number;
  byCategory: StuckMoneyCategory[];
  topDocuments: StuckMoneyDocument[];
  recoveryActions: string[];
}

export interface StuckMoneyCategory {
  label: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface StuckMoneyDocument {
  id: string;
  accessKey: string;
  issuerName: string;
  amount: number;
  daysStuck: number;
  reason: string;
  action: string;
}

export interface FiscalCalendarItem {
  id: string;
  obligation: string;
  companyId: string;
  companyName: string;
  competence: string;
  estimatedAmount: number;
  dueDate: string;
  status: FiscalCalendarStatus;
  responsible: FiscalResponsible;
  actions: FiscalCalendarAction[];
}

export type FiscalCalendarStatus =
  | "PENDING"
  | "OPEN"
  | "DUE_SOON"
  | "PAID"
  | "OVERDUE"
  | "WAITING_ACCOUNTANT";

export type FiscalCalendarAction =
  | "REQUEST_GUIDE"
  | "MARK_PAID"
  | "ATTACH_PROOF"
  | "VIEW_PENDENCY"
  | "SEND_ALERT";

export type RiskCategory = "VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AccountantRiskRanking {
  companies: AccountantRiskCompany[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    veryLow: number;
  };
}

export interface AccountantRiskCompany {
  id: string;
  name: string;
  score: number;
  riskLevel: RiskCategory;
  mainIssue: string;
  financialImpact: number;
  action: string;
  trend: "IMPROVING" | "STABLE" | "WORSENING";
  actionPlan: ActionPlanItem[];
  lastEventDate: string;
}

export interface AccountantWorkQueueItem {
  id: string;
  companyId: string;
  companyName: string;
  problem: string;
  responsible: FiscalResponsible;
  dueDate: string;
  financialImpact: number;
  status: FiscalIssueStatus;
  column: "CRITICAL" | "HIGH" | "MEDIUM" | "RESOLVED";
  actions: AccountantAction[];
}

export interface ActionPlanItem {
  id: string;
  description: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  responsible: FiscalResponsible;
  deadline: string;
  completed: boolean;
}

export type AccountantAction =
  | "ASSIGN_ACCOUNTANT"
  | "REQUEST_CLIENT"
  | "AUTO_FIX"
  | "IGNORE"
  | "MARK_RESOLVED";

export interface ClientRequest {
  id: string;
  companyId: string;
  companyName: string;
  message: string;
  channels: RequestChannel[];
  status: RequestStatus;
  sentAt: string;
  viewedAt?: string;
  answeredAt?: string;
  resolvedAt?: string;
  expiresAt: string;
}

export type RequestChannel = "WHATSAPP" | "EMAIL" | "INTERNAL" | "SECURE_LINK";

export interface InventoryIncomingItem {
  id: string;
  documentId: string;
  accessKey: string;
  supplierProductCode: string;
  supplierProductName: string;
  internalProductId?: string;
  internalProductName?: string;
  ncm: string;
  cest?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  isLinked: boolean;
  hasDivergence: boolean;
  divergenceType?: "UNIT" | "NCM" | "QUANTITY" | "VALUE";
  canAutoLaunch: boolean;
  status: "PENDING" | "LINKED" | "LAUNCHED" | "BLOCKED" | "SENT_TO_ACCOUNTANT";
}

export interface TaxReformImpact {
  companiesAnalyzed: number;
  productsImpacted: number;
  servicesImpacted: number;
  pendingRules: number;
  highRiskCompanies: number;
  items: TaxReformItem[];
}

export interface TaxReformItem {
  id: string;
  entityType: "product" | "service";
  entityId: string;
  name: string;
  cnae: string;
  cfop: string;
  currentCst: string;
  futureCClassTrib: string;
  ibsRate?: number;
  cbsRate?: number;
  affectedDocuments: number;
  impactedCompanies: number;
  status: "PENDING" | "APPLIED" | "REVIEW" | "IGNORED";
}

export interface NfseNationalChecklist {
  companyId: string;
  companyName: string;
  providerRegistered: boolean;
  servicesRegistered: number;
  nationalCodePending: number;
  municipalityPending: number;
  retentionsNotConfigured: number;
  incompleteTakners: number;
  status: "COMPLETE" | "IN_PROGRESS" | "NOT_STARTED";
}

export interface FiscalRadarAlert {
  id: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  estimatedImpact: number;
  dueDate?: string;
  category: "CERTIFICATE" | "PRODUCT" | "COMPANY" | "DOCUMENT" | "SPED" | "TAX";
  actions: FiscalRadarAction[];
  createdAt: string;
}

export type FiscalRadarAction =
  | "AUTO_FIX"
  | "APPLY_AI_SUGGESTION"
  | "REQUEST_CLIENT"
  | "SEND_TO_ACCOUNTANT";

export interface SegmentPackage {
  id: string;
  name: string;
  description: string;
  commonNcms: string[];
  commonCfops: string[];
  commonCsts: string[];
  commonPendencies: string[];
  stockRules: string[];
  fiscalChecklist: string[];
  customAlerts: string[];
}

export interface FiscalMaturityData {
  currentLevel: FiscalMaturityLevel;
  levelName: string;
  progress: number;
  requirements: FiscalMaturityRequirement[];
  nextLevelRequirements: string[];
}

export interface FiscalMaturityRequirement {
  id: string;
  description: string;
  completed: boolean;
  level: FiscalMaturityLevel;
}

export interface FiscalInboxItem {
  id: string;
  type: "XML_NEW" | "NOTE_REJECTED" | "CERTIFICATE_EXPIRING" | "GUIDE_DUE" | "CLIENT_INCOMPLETE" | "PRODUCT_NEW" | "CTE_UNLINKED" | "ACCOUNTANT_REQUEST" | "CLIENT_RESPONSE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  companyId: string;
  companyName: string;
  problem: string;
  responsible: FiscalResponsible;
  dueDate: string;
  financialImpact: number;
  status: FiscalIssueStatus;
  actions: FiscalInboxAction[];
}

export type FiscalInboxAction =
  | "ASSIGN_ACCOUNTANT"
  | "REQUEST_CLIENT"
  | "AUTO_FIX"
  | "IGNORE"
  | "MARK_RESOLVED";

export interface RejectionSimulation {
  rejectionChance: number;
  risks: RejectionRisk[];
  canEmit: boolean;
  criticalBlocking: boolean;
}

export interface RejectionRisk {
  id: string;
  label: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  autoFixAvailable: boolean;
  action: string;
}

export interface AccountantValueReport {
  period: string;
  validatedDocuments: number;
  classifiedProducts: number;
  correctedRejections: number;
  linkedCtes: number;
  verifiedGuides: number;
  unlockedAmount: number;
  details: AccountantValueDetail[];
}

export interface AccountantValueDetail {
  id: string;
  type: string;
  description: string;
  count: number;
  amount?: number;
}

export interface OnboardingFiscalData {
  importedXmls: number;
  createdProducts: number;
  createdClients: number;
  fiscalPendencies: number;
  accountantSuggestions: number;
  steps: OnboardingStep[];
}

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  action?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface FiscalLearningEntry {
  id: string;
  pattern: string;
  correction: string;
  confidence: number;
  timesApplied: number;
  lastApplied: string;
  createdBy: FiscalResponsible;
}

export type FiscalModuleKey =
  | "fiscal"
  | "nfe"
  | "nfce"
  | "nfse"
  | "cte"
  | "xml-fiscal"
  | "rejeicoes"
  | "sped"
  | "sintegra"
  | "fechamento-fiscal"
  | "previsao-impostos"
  | "guias";

export type FiscalValidationSeverity = "info" | "warning" | "error" | "critical";

export interface FiscalValidationIssue {
  code: string;
  module: FiscalModuleKey;
  field: string;
  message: string;
  impact: string;
  suggestion: string;
  severity: FiscalValidationSeverity;
  autoFixAvailable: boolean;
  autoFixValue?: string | number | boolean | null;
  ruleReference?: string | null;
}

export interface FiscalValidationResult {
  valid: boolean;
  score: number;
  issues: FiscalValidationIssue[];
  autoFixApplied: number;
  checkedAt: string;
}

export interface FiscalCalculationLine {
  label: string;
  grossAmount: number;
  discountAmount?: number;
  taxAmount?: number;
}

export interface FiscalCalculationSummary {
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  netAmount: number;
  lines: FiscalCalculationLine[];
}
