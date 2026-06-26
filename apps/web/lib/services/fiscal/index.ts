export * from "./accountant-service";
export * from "./accountant-value-report-service";
export * from "./audit-log-service";
export * from "./fiscal-ai-service";
export * from "./fiscal-calendar-service";
export * from "./fiscal-maturity-service";
export * from "./fiscal-score-service";
export * from "./fiscal-learning-service";
export * from "./nfse-national-service";
export * from "./onboarding-fiscal-service";
export * from "./rejection-simulator-service";
export * from "./segment-rules-service";
export * from "./stuck-money-service";
export * from "./tax-reform-service";
export * from "./inventory-service";

export {
  getFiscalAutopilotSummary,
  getFiscalAutopilotCategories,
  getFiscalAutopilotIssues,
  applyAutoFix,
  applyConfirmation,
  sendToAccountant as sendAutopilotToAccountant,
  revalidateAll,
  getRecentCorrections,
} from "./fiscal-autopilot-service";

export {
  getFiscalRadarAlerts,
  autoFixAlert,
  applyAISuggestion,
  sendToAccountant as sendRadarToAccountant,
  requestClient as requestRadarClient,
} from "./fiscal-radar-service";

export {
  getFiscalInbox,
  assignToAccountant,
  requestClient as requestInboxClient,
  autoFixInboxItem,
  ignoreInboxItem,
  markResolved,
  bulkAction,
} from "./fiscal-inbox-service";
