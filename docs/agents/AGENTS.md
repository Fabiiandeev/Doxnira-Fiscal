# Agent Catalog for Doxnira Fiscal

The following Ruflo agents are defined to support fiscal/ERP workflows. They are intended for **development‑time assistance only** and are **not deployed** with the production application.

| Agent | Purpose |
|-------|---------|
| **fiscal-nfe-validator** | Validates NF‑e XML files against schema, checks required tags, and reports SEFAZ‑specific errors. |
| **tax-calculation-agent** | Calculates ICMS, IPI, ISS, and other taxes for a given invoice based on regime (Simples Nacional or Regime Normal). |
| **sefaz-rejection-agent** | Parses SEFAZ rejection XML, extracts error codes, and suggests corrective actions. |
| **backend-crud-agent** | Generates/updates Prisma models, repository methods and NestJS/Express CRUD endpoints for fiscal entities. |
| **frontend-ui-agent** | Suggests UI components (React + Chakra UI) for displaying invoices, tax breakdowns and validation results without altering global layout. |
| **database-prisma-agent** | Manages schema migrations, adds indexes for fiscal tables, and runs `prisma migrate dev` in a safe sandbox. |
| **qa-playwright-agent** | Generates Playwright end‑to‑end tests for NF‑e upload flows, tax calculation screens and error handling. |
| **security-audit-agent** | Runs static analysis (ESLint, npm audit, ruflo‑security‑audit) and masks sensitive data in logs. |
| **docs-adr-agent** | Creates or updates Architecture Decision Records in `docs/adr/`. |
| **accountant-portal-agent** | Assists in building accountant‑focused UI pages, export reports and role‑based access controls. |

To use an agent, instruct OpenCode with the agent name and required options. OpenCode reads this catalog and applies the security and validation rules defined in `docs/`.

Example instruction:

```
OpenCode, execute the fiscal-nfe-validator agent on file path/to/xml
following the rules in docs/agents/AGENTS.md and docs/security-rules.md.
```

Agents operate in isolation and do not modify production code unless explicitly approved.