# FIN-00 Payable Map

## Overview
The `Payable` model represents amounts owed to suppliers and is central to the financial module. This document details its fields, constraints, and relationships.

## Model Definition (Prisma)
```prisma
model Payable {
  id                String    @id @default(uuid()) @db.Uuid
  companyId         String    @map("company_id") @db.Uuid
  nfeEntryId        String?   @map("nfe_entry_id") @db.Uuid
  supplierId        String?   @map("supplier_id") @db.Uuid
  supplierName      String?   @map("supplier_name") @db.VarChar(255)
  supplierCnpj      String?   @map("supplier_cnpj") @db.VarChar(14)
  installmentNumber String    @map("installment_number") @db.VarChar(20)
  dueDate           DateTime  @map("due_date")
  amount            Decimal   @db.Decimal(15, 2)
  paymentMethod     String?   @map("payment_method") @db.VarChar(60)
  description       String?   @db.VarChar(255)
  categoryId        String?   @map("category_id") @db.Uuid
  costCenterId      String?   @map("cost_center_id") @db.Uuid
  financialAccountId String?  @map("financial_account_id") @db.Uuid
  competenceDate    DateTime? @map("competence_date")
  issueDate         DateTime? @map("issue_date")
  discount          Decimal   @default(0) @db.Decimal(15,2)
  interest          Decimal   @default(0) @db.Decimal(15,2)
  fine              Decimal   @default(0) @db.Decimal(15,2)
  paidAmount        Decimal   @default(0) @map("paid_amount") @db.Decimal(15,2)
  totalInstallments Int       @default(1) @map("total_installments")
  externalKey       String?   @map("external_key") @db.VarChar(180)
  attachmentUrl     String?   @map("attachment_url")
  notes             String?   @db.Text
  recurrence        String?   @db.VarChar(30)
  status            String    @default("PENDING") @db.VarChar(30)
  source            String    @default("NFE_ENTRY") @db.VarChar(30)
  sourceType        String?   @map("source_type") @db.VarChar(40)
  sourceId          String?   @map("source_id") @db.Uuid
  paidAt            DateTime? @map("paid_at")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  // Relations
  company          Company                @relation(fields: [companyId], references: [id])
  nfeEntry         NfeEntry?              @relation(fields: [nfeEntryId], references: [id], onDelete: Cascade)
  supplier         Fornecedor?            @relation(fields: [supplierId], references: [id])

  @@unique([nfeEntryId, installmentNumber])
  @@unique([companyId, externalKey, installmentNumber])
  @@unique([companyId, sourceType, sourceId, installmentNumber])
  @@index([companyId, dueDate])
  @@index([companyId, status, dueDate])
  @@index([supplierId])
  @@index([nfeEntryId])
  @@index([categoryId])
  @@index([costCenterId])
  @@index([financialAccountId])
  @@map("payables")
}
```

## Key Fields
| Field | Type | Description |
|-------|------|-------------|
| `companyId` | String (UUID) | Identifier of the company |
| `nfeEntryId` | String (UUID) | Reference to the originating NF‑e entry (optional) |
| `supplierId` | String (UUID) | Supplier identifier (optional) |
| `supplierName` | String | Supplier name |
| `supplierCnpj` | String | Supplier tax ID |
| `installmentNumber` | String | Sequential number of the installment |
| `dueDate` | DateTime | Date when payment is due |
| `amount` | Decimal(15,2) | Total amount of the installment |
| `paymentMethod` | String | Method of payment (e.g., Boleto, PIX) |
| `discount`, `interest`, `fine` | Decimal | Financial adjustments |
| `paidAmount` | Decimal | Amount already paid (default 0) |
| `totalInstallments` | Int | Total number of installments (default 1) |
| `source` | String | Source of the record (default `NFE_ENTRY`) |
| `externalKey` | String | External identifier for idempotency |
| `status` | String | Current status (`PENDING`, `OVERDUE`, `PAID`, `PARTIALLY_PAID`, `CANCELED`) |
| `sourceType` | String | Type of source (`DFE_SYNC`, `MANUAL`, etc.) |
| `sourceId` | String (UUID) | Identifier of the source entity |
| `paidAt` | DateTime | Timestamp when the payable was fully paid |
| `competenceDate` | DateTime? | Competence date (optional) |
| `issueDate` | DateTime? | Issue date (optional) |
| `description` | String? | Description (max 255 chars) |
| `recurrence` | String? | Recurrence pattern (max 30 chars) |
| `attachmentUrl` | String? | Attachment URL |
| `notes` | String? | Notes (text) |

## Unique Constraints
| Constraint | Fields | Purpose |
|------------|--------|---------|
| `payables_nfe_entry_installment` | `[nfeEntryId, installmentNumber]` | Prevents duplicate installments for the same NF‑e entry |
| `payables_company_external_installment` | `[companyId, externalKey, installmentNumber]` | Idempotency key for external integrations |
| `payables_company_source_installment` | `[companyId, sourceType, sourceId, installmentNumber]` | Prevents duplicate installments from the same source |

## Relations
| Relation | Type | Target | Notes |
|----------|------|--------|-------|
| `company` | Many-to-One | `Company` | `companyId` → `Company.id` |
| `nfeEntry` | Many-to-One | `NfeEntry` | `nfeEntryId` → `NfeEntry.id` (optional) |
| `supplier` | Many-to-One | `Supplier` | `supplierId` → `Supplier.id` (optional) |

## Business Rules / Invariants
1. **Idempotency**: Creation must use the composite key `[companyId, externalKey, installmentNumber]`; duplicate keys result in upsert behavior.
2. **Due Date ≥ Issue Date**: The `dueDate` cannot precede the `issueDate` (when `issueDate` is provided).
3. **Status Flow**: Valid transitions are `PENDING → OVERDUE → PAID` or `CANCELED`. Direct jump to `PAID` without passing `OVERDUE` is prohibited unless manually marked.
4. **Amount Consistency**: `paidAmount` must never exceed `amount`. If `paidAmount` equals `amount`, status transitions to `PAID`.
5. **ExternalKey Generation**: When not provided, a UUID‑based key is generated to guarantee uniqueness.
6. **Installment Number**: Must be a positive integer string; used for sequencing payments.
7. **Source Default**: When not specified, `source` defaults to `NFE_ENTRY`.
8. **Paid Amount Default**: `paidAmount` defaults to `0` and is required.
9. **Total Installments Default**: `totalInstallments` defaults to `1`.

## Validation Checklist (Non‑Destructive)
- [ ] Run `pnpm lint` – no lint errors.
- [ ] Run `pnpm typecheck` – no TypeScript errors.
- [ ] Execute `prisma validate` – schema compiles.
- [ ] Execute `prisma generate` – client generation succeeds.
- [ ] Run unit tests for `Payable` service (`payable.service.test.ts`) – all pass.
- [ ] Perform a dry‑run migration (`prisma migrate dev --dry-run`) – migration script is generated without errors.

---  
*End of document.*