# FIN-00 Fiscal Sources Map

## Overview
Fiscal source models represent the raw fiscal documents that feed the financial system. They capture the full lifecycle of NF‑e, CT‑e, and related documents, including authorization, billing, and installment details.

## Core Fiscal Source Models

| Model | Purpose | Key Fields | Unique Constraints | Primary Relations |
|-------|---------|------------|--------------------|-------------------|
| **NfeDocument** | Main fiscal document (NFe) | `companyId`, `accessKey`, `model`, `serie`, `number`, `status`, `totalAmount`, `xmlStorageKey`, `xmlHashSha256`, `validationScore`, `deletedAt` | `[companyId, modelo, serie, ambiente, numero]`, `[companyId, accessKey, schemaName]` | `events`, `manifestations`, `items`, `alerts`, `downloadLogs`, `transportLinks`, `nfeEntry` |
| **NfeBilling** | Billing information linked to an NFe | `nfeDocumentId`, `valorPagamento`, `meioPagamento`, `cartaoCnpj`, `cartaoNumero` | `[nfeDocumentId]` | `document`, `installments` |
| **NfeInstallment** | Installment details of NFE billing | `nfeBillingId`, `numero`, `dataVencimento`, `valor` | — | `billing` |
| **NfeAuthorization** | Authorization metadata for NFe | `nfeDocumentId`, `cStat`, `xMotivo`, `protocolo`, `ambiente`, `dataAutorizacao`, `xmlProtocolo` | `[nfeDocumentId]` | `document` |
| **NfeEntry** | Entry of fiscal documents into the system | `companyId`, `fiscalDocumentId`, `supplierId`, `status`, `source`, `manifestationStatus`, `financialStatus`, `stockStatus`, `financialGeneratedAt`, `cTeStatus`, `sefazStatus`, `accessKey`, `nsu`, `number`, `series`, `issueDate`, `authorizationDate`, `supplierName`, `supplierCnpj`, `recipientCnpj`, `totalAmount`, `productsAmount`, `freightAmount`, `discountAmount`, `protocol`, `xmlStorageKey`, `xmlContent`, `xmlHashSha256`, `riskScore`, `recommendation`, `validationSummary`, `ignoredAt`, `confirmedAt`, `stockPostedAt`, `financialGeneratedAt` | `[companyId, accessKey]` | `company`, `fiscalDocument`, `supplier`, `items`, `productLinks`, `manifestations`, `events`, `cteLinks`, `allocationDocuments`, `stockMovements`, `payables`, `alerts`, `mdfeFiscalDocumentLinks`, `purchaseReceipts` |
| **NfeEntryItem** | Individual items within an NFE entry | `companyId`, `nfeEntryId`, `fiscalDocumentItemId`, `productId`, `itemNumber`, `supplierProductCode`, `ean`, `description`, `ncm`, `cfop`, `cst`, `csosn`, `unit`, `quantity`, `unitValue`, `totalValue`, `linkStatus`, `linkConfidence`, `stockIgnored` | `[nfeEntryId, itemNumber]` | `company`, `nfeEntry`, `fiscalDocumentItem`, `product`, `productLink`, `stockMovements`, `fiscalAlerts`, `cteAllocationItems` |
| **CteEntry** | Entry of transport documents (CTe) | `companyId`, `transportDocumentId`, `accessKey`, `number`, `series`, `issueDate`, `carrierName`, `carrierCnpj`, `recipientCnpj`, `freightAmount`, `status`, `sefazStatus`, `referencedNfeKeys`, `xmlStorageKey`, `xmlContent`, `source` | `[companyId, accessKey]` | `company`, `transportDocument`, `nfeLinks`, `allocations`, `auditLogs`, `mdfeFiscalDocumentLinks` |
| **CteEntryNfeLink** | Link between CT‑e and NFe entries | `companyId`, `cteEntryId`, `nfeAccessKey`, `freightShare`, `source` | `[companyId, cteEntryId, nfeAccessKey]` | `company`, `cteEntry`, `nfeEntry`, `allocationDocuments` |
| **CteAllocation** | Allocation of freight costs | `companyId`, `cteEntryId`, `method`, `status`, `serviceTotal`, `allocatableValue`, `allocatedValue`, `residualValue`, `configuration`, `calculationHash`, `version`, `createdBy`, `confirmedBy`, `confirmedAt`, `appliedAt` | `[cteEntryId, calculationHash]` | `company`, `cteEntry`, `creator`, `confirmer`, `documents` |

## Enums & Types Used
- **AllocationMethod**: `{ SERVICE_TOTAL, ALLOCATABLE_VALUE, RESIDUAL_VALUE }`
- **AllocationStatus**: `{ PENDING_CONFIGURATION, CONFIGURED, VALIDATED, APPLIED }`
- **SourceType**: `{ MANUAL, DFE_SYNC, OTHER }`
- **FiscalDocumentStatus**: `{ RASCUNHO, APROVADO, REJEITADO, CANCELADO }`
- **NfeEntryStatus**: `{ SINCRONIZADA, PENDENTE_VALIDACAO, PENDENTE_MANIFESTACAO, PENDENTE_ESTOQUE, PENDENTE_FINANCEIRO, SEM_CTE, VALIDADO, REVISAR }`
- **CteStatus**: `{ SEM_CTE, PROCESSANDO, VALIDADO, REJEITADO }`
- **RiskScore**: Numeric score indicating risk level for the entry.

## Relationships Summary
- **NfeDocument ↔ NfeBilling** (One‑to‑Many)
- **NfeDocument ↔ NfeInstallment** (One‑to‑Many)
- **NfeDocument ↔ NfeAuthorization** (One‑to‑One)
- **NfeDocument ↔ NfeEntry** (One‑to‑One, unique)
- **NfeEntry ↔ NfeEntryItem** (One‑to‑Many)
- **NfeEntry ↔ CteEntry** (One‑to‑Many via `CteEntryNfeLink`)
- **CteEntry ↔ CteAllocation** (One‑to‑Many)
- **NfeEntry ↔ Payable** (One‑to‑Many)
- **NfeEntry ↔ Receivable** (One‑to‑Many, via `source` linkage)
- **NfeEntry ↔ FinancialAlert** (One‑to‑Many)
- **CteEntry ↔ CteEntryNfeLink** (One‑to‑Many)
- **CteEntryNfeLink ↔ NfeEntry** (Many‑to‑One)

## Validation & Integrity Rules
1. **Unique AccessKey per Company**: Both `NfeDocument.accessKey` and `CteEntry.accessKey` must be unique within a `companyId`.
2. **NFe Entry Linkage**: An `NfeEntry` must reference an existing `FiscalDocumentId`; deletion of the referenced document cascades to the entry.
3. **Installment Number Sequence**: `NfeInstallment.numero` must be sequential per `NfeBilling`.
4. **Freight Allocation Consistency**: `CteAllocation.allocatedValue` must not exceed `CteEntry.freightAmount`.
5. **RiskScore Threshold**: Entries with `riskScore` > 80 must be flagged for manual review before financial generation.
6. **Status Transition**: Status fields (`status`, `manifestationStatus`, `financialStatus`) follow a strict enum flow; unauthorized transitions must be blocked by business logic.

## Migration Considerations
- **Add Missing Fields**: Populate `sourceType` and `sourceId` on `Receivable` to align with `Payable` constraints.
- **Enforce XOR Constraint**: Ensure `FinancialTransaction` enforces XOR between `payableId` and `receivableId` at the application level.
- **Data Backfill**: Run scripts to copy `source` and `sourceId` from `NfeEntry` to related `Payable` and `Receivable` records.
- **Schema Validation**: Run `prisma validate` and `prisma generate` after schema updates.

---  
*End of document.*