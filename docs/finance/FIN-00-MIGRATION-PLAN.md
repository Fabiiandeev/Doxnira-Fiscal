# FIN-00 Migration Plan

## Overview
The migration plan outlines non‑destructive schema and data adjustments required to bring the financial and fiscal modules into full compliance with the FIN‑00 audit invariants. All changes are designed to be reversible via Prisma migration rollbacks.

## Migration Steps

| Phase | Description | Commands | Validation |
|-------|-------------|----------|------------|
| **1. Add Missing Fields** | Populate `sourceType` and `sourceId` on `Receivable` to align with `Payable` constraints. | `prisma migrate dev --name add_source_fields_to_receivable` (generated migration) | `pnpm typecheck`, `prisma validate` |
| **2. Enforce XOR Constraint** | Ensure `FinancialTransaction` enforces XOR between `payableId` and `receivableId`. | Update `FinancialTransaction` model with `@@unique([payableId, receivableId])` and add application‑level guard in `financial.service.js`. | Run unit tests for `FinancialTransaction` service; `pnpm test financial.transaction.test.ts` |
| **3. Backfill Source Data** | Copy `source` and `sourceId` from `NfeEntry` to related `Payable` and `Receivable` records. | Execute `scripts/backfill-source-data.mjs` (Node script) | Verify output with `pnpm run validate:backfill` |
| **4. Update Unique Indexes** | Add composite unique indexes for `Payable` (`[companyId, externalKey, installmentNumber]`) and `NfeDocument` (`[companyId, accessKey]`). | Modify `schema.prisma` and run `prisma migrate dev --name add_unique_indexes`. | `prisma validate` succeeds; no migration conflicts |
| **5. Add Missing Enum Values** | Extend `FinancialTransactionType` enum to include new types if needed. | Update enum in `schema.prisma` and generate migration. | `pnpm typecheck` passes |
| **6. Deploy Configuration Changes** | Add `riskScore` field to `NfeEntry` and `CteAllocation` if missing. | `prisma migrate dev --name add_risk_score_fields`. | `prisma validate` passes |
| **7. Soft‑Delete Enforcement** | Ensure all mutable entities use `deletedAt` for soft deletes. | Update Prisma models to add `@default(null) deletedAt DateTime?` where missing; generate migration. | `prisma validate` passes; run soft‑delete integration tests. |
| **8. Final Validation** | Run full suite of non‑destructive checks. | `pnpm lint`, `pnpm typecheck`, `prisma validate`, `prisma generate`, `pnpm test` | All checks must pass before merging to `main`. |

## Rollback Strategy
- Each migration is versioned and stored in `prisma/migrations/`.  
- To rollback, execute `prisma migrate reset --applied-migrations-only` followed by `prisma migrate dev --name <previous_migration>` to restore the prior state.  
- Data backfill scripts are idempotent; re‑running them after rollback will not cause duplication.

## Migration Timeline
| Milestone | Estimated Completion |
|-----------|----------------------|
| Phase 1 – Add missing fields | Day 1 |
| Phase 2 – XOR constraint enforcement | Day 2 |
| Phase 3 – Backfill source data | Day 3 |
| Phase 4 – Unique indexes & enums | Day 4 |
| Phase 5 – Risk score fields | Day 5 |
| Phase 6 – Soft‑delete enforcement | Day 6 |
| Phase 7 – Final validation | Day 7 |

## Success Criteria
- All migration scripts apply cleanly without conflicts.  
- Post‑migration validation checklist passes 100%.  
- No breaking changes to public API.  
- Documentation (this plan) is updated with any deviations.

---  
*End of document.*