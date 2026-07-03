export interface NfeValidationIssue {
  code: string;
  category: string;
  severity: "CRITICAL" | "ERROR" | "ALERT" | "INFO";
  field: string;
  description: string;
  impact: string;
  howToFix: string;
  autoCorrectAvailable: boolean;
  autoCorrectValue: unknown;
  baseLegal: string;
  resolved: boolean;
}

export interface NfeValidationPhase {
  phase: string;
  name: string;
  issueCount: number;
}

export interface NfeValidationRun {
  id: string;
  companyId: string;
  userId: string;
  nfeData: unknown;
  status: string;
  score: number;
  errorCount: number;
  alertCount: number;
  infoCount: number;
  autoCorrections: number;
  rejectionProbability?: string;
  situation?: string;
  canTransmit: boolean;
  issues: NfeValidationIssue[];
  phases: NfeValidationPhase[];
  durationMs: number;
  validatedAt: string;
  createdAt: string;
}
