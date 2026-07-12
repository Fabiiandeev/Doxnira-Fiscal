export type DomainIssueSeverity = "info" | "warning" | "error";

export type DomainValidationIssue = {
  field: string;
  message: string;
  severity: DomainIssueSeverity;
};

export type DomainValidationResult = {
  valid: boolean;
  issues: DomainValidationIssue[];
};

export type ServiceModuleStatus = {
  status: "ready" | "not_connected" | "in_development";
  message: string;
};

export function mapIdentity<T>(input: T): T {
  return input;
}

export function createValidationResult(issues: DomainValidationIssue[] = []): DomainValidationResult {
  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
}
