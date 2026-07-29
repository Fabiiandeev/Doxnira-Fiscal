# FIN-00 Invariants

## Overview
Invariants are logical constraints that must hold true across the financial and fiscal modules at all times. This document enumerates all such invariants identified during the audit phase.

## Financial Invariants

| Invariant | Description | Enforcement Mechanism |
|-----------|-------------|-----------------------|
| **Idempotent Creation** | Payable and Receivable records must be uniquely identifiable by `[companyId, externalKey, installmentNumber]`. Duplicate keys trigger an upsert rather than a new record. | Composite unique index in Prisma schema; upsert operation in service layer. |
| **Due Date ≥ Issue Date** | For every Payable/Receivable, `dueDate` cannot precede `issueDate`. | Validation in `createInstallments` and `createReceivable` services; throws `AppError` if violated. |
| **Status Flow** | Status transitions must follow: `PENDING → OVERDUE → PAID` (or `CANCELED`). Skipping `OVERDUE` is only allowed via explicit manual override. | Business logic in `settle` and `cancel` methods; status checks before state change. |
| **Amount Consistency** | `paidAmount` must never exceed `amount`. When `paidAmount` equals `amount`, status moves to `PAID`. | Service validation before updating `status` and `paidAmount`. |
| **ExternalKey Generation** | If `externalKey` is not supplied, a UUID is generated to guarantee uniqueness. | Default value generation in service layer (`randomUUID()`). |
| **Installment Number Sequence** | `installmentNumber` must be a positive integer string and must increment monotonically per source. | Validation in `createInstallments`; rejects non‑numeric or out‑of‑order numbers. |
| **XOR Constraint (FinancialTransaction)** | Exactly one of `payableId` or `receivableId` must be set for each `FinancialTransaction`. | Application‑level check in `createFinancialTransaction`; throws error if both or neither are set. |
| **NFe Entry FinancialStatus** | An `NfeEntry` must have `financialStatus` = `PENDENTE_FINANCEIRO` before a related `Payable` can be generated. | Guard clause in `generatePayablesFromNfeEntry` service. |
| **Freight Allocation Consistency** | `CteAllocation.allocatedValue` must not exceed the `freightAmount` of the linked `CteEntry`. | Validation in `allocateFreight` service; throws `AppError` if violated. |
| **RiskScore Threshold** | Entries with `riskScore` > 80 must be flagged for manual review before financial generation. | UI flag and backend middleware; prevents auto‑generation of payables for high‑risk entries. |
| **Unique AccessKey per Company** | `NfeDocument.accessKey` and `CteEntry.accessKey` must be unique within the same `companyId`. | Unique composite index in Prisma schema. |
| **Reference Integrity** | `NfeEntry.fiscalDocumentId` must reference an existing `FiscalDocument`; deletion of the document must cascade to the entry. | Foreign key constraint and `onDelete` cascade in Prisma schema. |
| **Status Transition Validation** | Status fields (`status`, `manifestationStatus`, `financialStatus`) must transition only according to allowed enum sequences. | Centralized validation utility used across services. |

## Fiscal Invariants

| Invariant | Description | Enforcement Mechanism |
|-----------|-------------|-----------------------|
| **NFe Document Uniqueness** | Combination `[companyId, modelo, serie, ambiente, numero]` must be unique. | Unique composite index in Prisma schema. |
| **NFe Entry AccessKey Uniqueness** | `[companyId, accessKey]` must be unique across all fiscal documents. | Unique index in Prisma schema. |
| **CteEntry AccessKey Uniqueness** | `[companyId, accessKey]` must be unique. | Unique index in Prisma schema. |
| **CteEntryNfeLink Composite Uniqueness** | `[companyId, cteEntryId, nfeAccessKey]` must be unique. | Unique index in Prisma schema. |
| **CteAllocation CalculationHash Uniqueness** | `[cteEntryId, calculationHash]` must be unique. | Unique index in Prisma schema. |
| **NfeBilling Idempotency** | `nfeDocumentId` must be unique per billing record. | Unique index on `nfeDocumentId`. |
| **Invoice Number Sequence** | For a given `NfeEntry`, `itemNumber` must be sequential and unique. | Validation in `NfeEntryItem` creation logic. |
| **FreightShare Non‑Negative** | `freightShare` in `CteEntryNfeLink` must be ≥ 0. | Service validation before persisting. |
| **AllocationMethod Validity** | `method` in `CteAllocation` must be one of the defined enum values. | Enum validation in Prisma schema. |
| **AllocationStatus Transition** | `status` in `CteAllocation` must follow `PENDING_CONFIGURATION → CONFIGURED → VALIDATED → APPLIED`. | Guarded transitions in `CteAllocation` service. |
| **Payload Size Limit** | JSON fields (`validationSummary`, `auditTrail`, `configuration`) must not exceed 5 MB. | Pre‑save validation middleware. |
| **XML Hash Consistency** | `xmlHashSha256` must match a SHA‑256 hash of the stored `xmlContent`. | Computed on write and stored for integrity check. |
| **RiskScore Calculation** | `riskScore` must be recomputed if any of its source fields (`totalAmount`, `discountAmount`, etc.) change. | Trigger function on related field updates. |

## Cross‑Domain Invariants

| Invariant | Description | Enforcement Mechanism |
|-----------|-------------|-----------------------|
| **Permission Check** | All financial operations must be preceded by a permission check (`viewerForbidden`). | Middleware intercepts all route handlers; throws `ViewerForbiddenError` if role is insufficient. |
| **Audit Logging** | Every create, update, delete operation on financial or fiscal entities must generate an `AuditLog` entry. | Service layer calls `writeAudit` after each mutation. |
| **Non‑Destructive Validation** | Before any migration, run `pnpm lint`, `pnpm typecheck`, `prisma validate`, `prisma generate`. | CI pipeline step; fails the pipeline if any check fails. |
| **Data Retention** | Deleted records must be soft‑deleted (`deletedAt` set) rather than hard‑deleted, preserving audit trail. | Prisma `@default(null)` on `deletedAt`; service layer implements soft‑delete. |
| **Immutable Reference Fields** | Fields like `companyId`, `accessKey`, `fiscalDocumentId` are immutable after creation. | Prisma `@immutable` attribute (if supported) or service‑level enforcement. |
| **Versioning of Configurations** | Configuration objects (e.g., `CteAllocation.configuration`) must be versioned; older versions cannot be overwritten. | Version field in schema and validation logic. |
| **ExternalKey Persistence** | Once an `externalKey` is assigned to a Payable/Receivable, it must never change. | Validation in update operations; rejects changes to `externalKey`. |
| **Payment Method Whitelist** | `paymentMethod` must be one of the allowed enum values (`PIX`, `BOLETO`, `CREDIT_CARD`, `MANUAL`). | Enum validation in Prisma schema. |
| **Currency Consistency** | All monetary fields in the financial module must use the same currency (`BRL`). | Validation in service layer; rejects foreign currency amounts. |
| **Decimal Precision** | All `Decimal` fields must maintain precision `(15,2)`. | Prisma schema definition; DB constraint. |
| **Date Logic** | `dueDate` must be a future date relative to `issueDate` unless status is `OVERDUE`. | Service validation before persisting. |
| **Batch Processing Limits** | Batch jobs (e.g., `generatePayablesFromNfeEntry`) must process no more than 10 000 records per run to avoid timeout. | Job scheduler enforces limit; logs warning if limit approached. |

---  
*End of document.*