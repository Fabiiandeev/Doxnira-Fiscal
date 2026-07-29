# FIN-00 Schema Map

## Overview
This document maps the database schema relevant to the financial and fiscal modules, focusing on models, relationships, and constraints that support audit, governance, and compliance.

## Core Financial Models
| Model | Purpose | Key Fields | Unique Constraints | Relations |
|-------|---------|------------|--------------------|-----------|
| `Payable` | Amounts owed to suppliers | `companyId`, `nfeEntryId`, `supplierId`, `installmentNumber`, `dueDate`, `amount`, `paymentMethod`, `description`, `competenceDate`, `issueDate`, `discount`, `interest`, `fine`, `paidAmount`, `totalInstallments`, `source`, `externalKey`, `attachmentUrl`, `notes`, `recurrence`, `status`, `sourceType`, `sourceId` | `[companyId, externalKey, installmentNumber]`, `[nfeEntryId, installmentNumber]`, `[companyId, sourceType, sourceId, installmentNumber]` | `company`, `nfeEntry`, `supplier` |
| `Receivable` | Receivables from clients | `companyId`, `clientId`, `installmentNumber`, `dueDate`, `amount` | `[companyId, externalKey, installmentNumber]` | `company`, `client` |
| `FinancialCategory` | Classification of financial events | `companyId`, `name`, `type` | `[companyId, name, type]` | — |
| `CostCenter` | Cost allocation units | `companyId`, `code`, `name` | `[companyId, code]` | — |
| `FinancialAccount` | Bank and cash accounts | `companyId`, `name`, `type` | `[companyId, name]` | — |
| `FinancialTransaction` | General ledger entries | `companyId`, `financialAccountId`, `payableId`, `receivableId`, `type`, `amount` | `[companyId, externalKey]` | `company`, `financialAccount`, `payable`, `receivable` |
| `FinancialReconciliation` | Reconciliation of transactions | `companyId`, `transactionId`, `expectedAmount`, `actualAmount` | — | `company`, `transaction` |

## Core Fiscal Source Models
| Model | Purpose | Key Fields | Unique Constraints | Relations |
|-------|---------|------------|--------------------|-----------|
| `NfeDocument` | Main fiscal document (NFe) | `companyId`, `accessKey`, `model`, `serie`, `number`, `status`, `totalAmount` | `[companyId, modelo, serie, ambiente, numero]`, `[companyId, accessKey, schemaName]` | `events`, `manifestations`, `items`, `alerts`, `downloadLogs`, `transportLinks` |
| `NfeBilling` | Billing information linked to NFe | `nfeDocumentId`, `valorPagamento`, `meioPagamento` | `[nfeDocumentId]` | `document`, `installments` |
| `NfeInstallment` | Installment details of NFE billing | `nfeBillingId`, `numero`, `dataVencimento`, `valor` | — | `billing` |
| `NfeAuthorization` | Authorization metadata for NFe | `nfeDocumentId`, `protocolo`, `cStat`, `xMotivo` | `[nfeDocumentId]` | `document` |
| `NfeEntry` | Entry of fiscal documents into the system | `companyId`, `fiscalDocumentId`, `supplierId`, `status`, `source`, `manifestationStatus`, `financialStatus`, `totalAmount` | `[companyId, accessKey]` | `company`, `fiscalDocument`, `supplier`, `items`, `alerts`, `payables` |
| `NfeEntryItem` | Individual items within an NFE entry | `companyId`, `nfeEntryId`, `productId`, `quantity`, `unitValue`, `totalValue` | `[nfeEntryId, itemNumber]` | `company`, `nfeEntry`, `fiscalDocumentItem`, `product`, `stockMovements` |
| `CteEntry` | Entry of transport documents (CTe) | `companyId`, `accessKey`, `number`, `status`, `freightAmount` | `[companyId, accessKey]` | `company`, `transportDocument`, `nfeLinks`, `allocations` |
| `CteEntryNfeLink` | Link between CT-e and NFe entries | `companyId`, `cteEntryId`, `nfeAccessKey`, `freightShare` | `[companyId, cteEntryId, nfeAccessKey]` | `company`, `cteEntry`, `nfeEntry`, `allocationDocuments` |
| `CteAllocation` | Allocation of freight costs | `companyId`, `cteEntryId`, `method`, `status`, `serviceTotal`, `allocatableValue`, `allocatedValue` | `[cteEntryId, calculationHash]` | `company`, `cteEntry`, `creator`, `confirmer`, `documents` |

## Enums and Types
- `AllocationMethod`: `{ SERVICE_TOTAL, ALLOCATABLE_VALUE, RESIDUAL_VALUE }`
- `AllocationStatus`: `{ PENDING_CONFIGURATION, CONFIGURED, VALIDATED, APPLIED }`
- `SourceType`: `String` (no enum); possible values include `MANUAL`, `NFE_ENTRY`, `DFE_SYNC`, `PURCHASE_RECEIPT`, `SALES_ORDER`, etc.
- `FinancialTransactionType`: `{ OUTFLOW, INFLOW }`
- `PayableStatus`: `{ PENDING, OVERDUE, PAID, PARTIALLY_PAID, CANCELED }`
- `ReceivableStatus`: `{ PENDING, OVERDUE, RECEIVED, PARTIALLY_RECEIVED }`

## Payable Model Details (Prisma)
```prisma
model Payable {
  id                 String   @id @default(uuid()) @db.Uuid
  companyId          String   @map("company_id") @db.Uuid
  nfeEntryId         String   @map("nfe_entry_id") @db.Uuid
  supplierId         String?  @map("supplier_id") @db.Uuid
  supplierName       String?  @map("supplier_name") @db.VarChar(255)
  supplierCnpj       String?  @map("supplier_cnpj") @db.VarChar(14)
  installmentNumber  String   @map("installment_number") @db.VarChar(20)
  dueDate            DateTime @map("due_date")
  amount             Decimal  @db.Decimal(15, 2)
  paymentMethod      String?  @map("payment_method") @db.VarChar(60)
  description        String?  @db.VarChar(5000)
  categoryId         String?  @map("category_id") @db.Uuid
  costCenterId       String?  @map("cost_center_id") @db.Uuid
  financialAccountId String?  @map("financial_account_id") @db.Uuid
  competenceDate     DateTime @map("competence_date")
  issueDate          DateTime @map("issue_date")
  discount           Decimal  @default(0) @map("discount")
  interest           Decimal  @default(0) @map("interest")
  fine               Decimal  @default(0) @map("fine")
  paidAmount         Decimal  @default(0) @map("paid_amount") @db.Decimal(15, 2)
  totalInstallments  Int      @default(1) @map("total_installments")
  source             String   @default("NFE_ENTRY") @db.VarChar(30)
  externalKey        String?  @map("external_key") @db.VarChar(180)
  attachmentUrl      String?  @map("attachment_url") @db.Text
  notes              String?  @map("notes") @db.Text
  recurrence         String?  @map("recurrence") @db.Enum("WEEKLY","MONTHLY","YEARLY")
  status             String   @default("PENDING") @db.VarChar(30)
  sourceType         String?  @map("source_type") @db.VarChar(40)
  sourceId           String?  @map("source_id") @db.Uuid
  paidAt             DateTime? @map("paid_at")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")
}
```
- **`source`**: defaults to `"NFE_ENTRY"`; max length 30.  
- **`sourceType`**: optional; no default; used to indicate the origin type (e.g., `MANUAL`, `NFE_ENTRY`).  
- **`installmentNumber`**: required; max length 20.  
- **`status`**: required; max length 30; default `"PENDING"`.  
- **`paidAmount`**: required; default `0`; type `Decimal(15,2)`.  

## Invariants
- **Idempotency**: Payable and Receivable enforce uniqueness on `[companyId, externalKey, installmentNumber]`.  
- **Temporal Consistency**: `dueDate` must be on or after `issueDate` for Payable/Receivable.  
- **Status Flow**: Status transitions must follow: `PENDING → OVERDUE → PAID/PARTIALLY_PAID` (Payable) and similar for Receivable.  
- **FinancialTransaction XOR**: Exactly one of `payableId` or `receivableId` must be set (application‑level enforcement required).  
- **NFe Entry Link**: `NfeEntry.financialStatus` must be `PENDENTE_FINANCEIRO` before a Payable can be generated.  
- **Permission Enforcement**: All financial operations require `VIEWER` role check via `viewerForbidden`.  

## Migration Plan (High‑Level)
1. **Schema Extension**: Add missing fields to `Receivable` (sourceType, sourceId) and `FinancialCategory` (hierarchy).  
2. **Constraint Enforcement**: Implement DB‑level XOR constraint for `FinancialTransaction`.  
3. **Data Migration**: Populate new fields from existing fiscal source models.  
4. **Validation**: Run non‑destructive lint, typecheck, and prisma validate.  
5. **Certification**: Generate FIN‑00 certification after successful validation.  

---  
*End of document.*