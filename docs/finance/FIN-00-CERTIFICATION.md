# FIN-00 — Certificação técnica de baseline e governança

## Identificação

- **Status:** `PAYABLES_MODULE_CERTIFIED`
- **Status Railway:** `PAYABLES_HOMOLOGATION_CERTIFIED`
- **Branch:** `feature/mdfe-auto-from-nfe`
- **Baseline / HEAD inicial:** `0150725510e725e374a59ca16bdd157837226493`
- **HEAD de correção P2007:** `ffd7e3f`
- **Data da revalidação:** 2026-08-04
- **Escopo:** baseline, inventário, invariantes, permissões, riscos, plano de migration, capacidade de validação em banco isolado e homologação Railway.

Esta certificação é técnica e baseada em comandos reproduzíveis. Não representa homologação bancária, contábil ou assinatura de stakeholder. Implementações funcionais pertencem a FIN-01 em diante e devem possuir certificação própria.

## Preservação do repositório

Antes das alterações foram registrados branch, HEAD e working tree. As mudanças preexistentes em Marketplace, Web, infraestrutura e `schema.prisma` foram preservadas. Não foram executados `reset`, `clean`, `restore`, `stash`, troca de branch, merge, rebase, commit, push ou exclusão de arquivo preexistente.

## Falha encontrada e corrigida (#1 — P2022)

O Prisma model `Payable` esperava `source_type` e `source_id`, mas nenhuma migration criava essas colunas. Isso causava `P2022` e HTTP 500 na criação de contas a pagar.

A migration aditiva `20260801010000_fix_payable_financial_source`:

- adiciona as duas colunas;
- faz backfill a partir de `nfe_entry_id`;
- exige que tipo e identificador estejam ambos preenchidos ou ambos nulos;
- cria a chave única multiempresa de origem e parcela;
- executa em transação curta;
- não remove tabelas, colunas ou dados.

Compensação operacional: em caso de falha antes do `COMMIT`, PostgreSQL reverte integralmente a migration. Após aplicação, uma reversão destrutiva das colunas não é automática; deve ser feita apenas por migration compensatória aprovada, depois de confirmar que não existem consumidores nem dados exclusivos nos novos campos.

## Falha encontrada e corrigida (#2 — P2007)

### Contexto

Após deploy do commit `f411637` no Railway, as mutações (baixa parcial, baixa total, cancelamento, reabertura) retornavam `P2007` (data validation error). A criação de contas a pagar funcionava normalmente (HTTP 201).

### Causa raiz (comprovada)

O `schema.prisma` no commit `f411637` não continha os modelos introduzidos pela migration `20260801020000_fin01_audit_membership_soft_delete`:
- `FinancialEvent`
- `CompanyMembership`
- `FinancialAllocation`
- `FinancialAttachment`

O código em `financial.service.js` chamava `writeFinancialAudit()` em `audit.service.js`, que por sua vez invocava `client.financialEvent.create(...)`. Sem o modelo no schema, o Prisma Client gerado no deploy não reconhecia `financialEvent`, causando erro de validação em todas as mutações. A criação não falhava porque não invocava a função de auditoria completa.

### Constraint
- P2007: `PrismaClientValidationError`
- Tabela filha: `financial_events`
- Tabela pai: não aplicável — erro de validação lado cliente
- Operação: `writeFinancialAudit()` → `client.financialEvent.create()`
- Arquivo: `apps/api-js/src/modules/audit/audit.service.js`

### Correção

Commit `ffd7e3f` adicionou os modelos faltantes ao `schema.prisma`, expandiu `audit.service.js` com `writeFinancialAudit()` e `sanitizeAuditPayload()`, e alinhou os schemas financeiros com aritmética `Decimal` (`moneySchema`). Nenhum FK foi removido, nenhum dado foi destruído, nenhum teste foi altera do para ocultar o erro.

### Deploy

- Commit: `ffd7e3f` (branch `feature/mdfe-auto-from-nfe`)
- Deploy Railway: `44dfb5fd` (SUCCESS)
- Migrations: 50 aplicadas, 0 pendentes
- Health: HTTP 200

### Smoke Railway pós-correção

| Operação | Resultado |
|---|---|
| Baixa parcial | OK — `FinancialEvent` e `AuditLog` criados |
| Baixa total | OK — status `PAID`, movimento financeiro criado |
| Cancelamento | OK — `canceledAt` + `canceledBy` persistidos |
| Reabertura | OK — status restaurado para `PENDING` |
| Auditoria | OK — `FinancialEvent` + `AuditLog` gerados em cada etapa |

Nenhum Supabase acessado. Nenhum dado sensível exposto.

## Evidências executadas

| Validação | Resultado |
|---|---:|
| Banco de teste identificado (`ns_fiscal_cloud_test`, localhost) | PASS |
| Prisma migrate deploy — 50 migrations (Railway) | PASS |
| Validação pós-migration das colunas e constraint | PASS |
| Pares `source_type`/`source_id` inválidos | 0 |
| Testes unitários financeiros | 31/31 PASS |
| Testes HTTP financeiros (E2E) | 10/10 PASS |
| Testes unitários API | 92/92 PASS |
| Testes integração API | 9/9 PASS |
| Suíte E2E (NF-e, CT-e) | 2/2 PASS |
| API lint/build | PASS |
| Web lint | PASS |
| Web typecheck | PASS |
| Web build | PASS |
| Prisma validate | PASS |
| Prisma generate | PASS |
| `git diff --check` | PASS |
| Railway health/live/ready | HTTP 200 |
| Smoke Railway — baixa parcial | PASS |
| Smoke Railway — baixa total | PASS |
| Smoke Railway — cancelamento | PASS |
| Smoke Railway — reabertura | PASS |
| Smoke Railway — auditoria (FinancialEvent + AuditLog) | PASS |

## Artefatos de governança

- `FIN-00-BASELINE.md`
- `FIN-00-SCHEMA-MAP.md`
- `FIN-00-PAYABLE-MAP.md`
- `FIN-00-FISCAL-SOURCES.md`
- `FIN-00-PERMISSIONS.md`
- `FIN-00-EVENT-MATRIX.md`
- `FIN-00-INVARANTS.md`
- `FIN-00-MIGRATION-PLAN.md`
- `FIN-00-RISKS.md`

Os itens descritos nesses documentos como “proposed”, pendentes ou futuros não são implicitamente certificados por FIN-00; devem ser comprovados na sprint funcional correspondente.

## Resultado

**PAYABLES_MODULE_CERTIFIED** para baseline, governança e homologação Railway.

- P2022 corrigido (migration `20260801010000_fix_payable_financial_source`)
- P2007 corrigido (commit `ffd7e3f` — modelos `FinancialEvent`, `CompanyMembership`, etc. adicionados ao schema)
- Todos os gates locais verdes (92 unitários, 9 integração, 10 E2E financeiro)
- Smoke Railway completo: baixa parcial, baixa total, cancelamento, reabertura, auditoria e timeline
- Nenhum Supabase acessado
- Nenhum FK removido ou alteração destrutiva

Próxima ação: certificar FIN-01 — operações financeiras completas com VIEWER, multiempresa e automação de compras.
