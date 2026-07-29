# FIN-00 Risks

## Overview
This document identifies and assesses risks associated with the FIN‑00 audit phase, focusing on data integrity, compliance, and operational continuity.

## Risk Catalog

| Risk ID | Description | Likelihood | Impact | Mitigation |
|---------|-------------|------------|--------|------------|
| **R1** | **Missing `sourceType` / `sourceId` on `Receivable`** – leads to idempotency violations and duplicate records. | Medium | High | Backfill script; enforce schema constraints; unit tests. |
| **R2** | **XOR constraint not enforced** – could create financial transactions with both `payableId` and `receivableId`, breaking accounting balances. | Low | High | Application‑level guard; DB unique index; automated test coverage. |
| **R3** | **Incorrect status transition** – status jumps from `PENDING` to `PAID` without passing `OVERDUE`, causing inaccurate aging reports. | Medium | Medium | Validation middleware; status transition tests; audit logs. |
| **R4** | **Freight allocation exceeds available freight** – `CteAllocation.allocatedValue` > `CteEntry.freightAmount` leads to over‑billing. | Low | Medium | Validation in `allocateFreight`; DB check; periodic reconciliation job. |
| **R5** | **RiskScore calculation drift** – stale `riskScore` values cause false positives/negatives in alerting. | Medium | Medium | Re‑calculate on any dependent field change; scheduled recompute job. |
| **R6** | **Schema migration conflicts** – adding unique indexes may fail if duplicate data exists. | Medium | High | Data clean‑up scripts before migration; migration dry‑run; backup of production DB. |
| **R7** | **Permission mis‑configuration** – overly permissive roles could allow unauthorized modifications. | Low | High | Role‑based middleware tests; periodic permission audit; CI check for role definitions. |
| **R8** | **AuditLog omission** – missing audit entries reduce traceability. | Low | Medium | Enforce audit logging in every service; integration test that verifies at least one `AuditLog` entry per mutation. |
| **R9** | **Data backfill corruption** – backfill script may duplicate or corrupt records. | Low | High | Idempotent script; transactional batch processing; verify row counts before/after. |
| **R10** | **Performance degradation** – large batch jobs (e.g., risk scoring) may cause timeouts. | Medium | Low | Batch size limiting; async processing with concurrency control; monitoring of job duration. |

## Risk Monitoring
- **Daily**: Review `RiskScored` events for `HIGH`/`CRITICAL` alerts.
- **Weekly**: Run `pnpm lint`, `pnpm typecheck`, and migration validation on a staging DB.
- **Monthly**: Conduct a full audit of permission assignments and audit log completeness.

## Escalation Procedure
1. **Detect** – Alert triggered by `RiskScored` event or CI failure.  
2. **Triage** – Assign to on‑call FinOps engineer.  
3. **Mitigate** – Apply hot‑fix branch; run regression tests.  
4. **Notify** – Send notification to stakeholders via Slack `#finance-audit`.  
5. **Post‑mortem** – Document root cause and update risk register.

---  
*End of document.*