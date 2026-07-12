import { createValidationResult } from "@/lib/services/service-architecture";
import type { DomainValidationIssue } from "@/lib/services/service-architecture";
import type { FiscalDocument } from "@/lib/services/fiscal/types";

import {
  buildFiscalDraftValidationIssues,
  inferFiscalModule,
} from "./core";

export function validateFiscalDocumentDraft(document: Partial<FiscalDocument>) {
  const issues: DomainValidationIssue[] = buildFiscalDraftValidationIssues(
    document,
    inferFiscalModule(document),
  ).map((issue) => ({
    field: issue.field,
    message: issue.message,
    severity:
      issue.severity === "info"
        ? "info"
        : issue.severity === "warning"
          ? "warning"
          : "error",
  }));

  return createValidationResult(issues);
}
