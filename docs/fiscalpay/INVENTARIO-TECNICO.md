# Inventário técnico — FiscalPay

**Base analisada:** `7f5e47cb8e9b102dc0c941a3a4bb3484af93df74` (`SPRING MDF-E`)
**Data:** 20 de julho de 2026
**Schema:** `apps/api-js/prisma/schema.prisma`

## Banco autorizado

| Entidade | Campos relevantes | Relações e restrições |
| --- | --- | --- |
| `Payable` | `id`, `companyId`, `nfeEntryId`, `supplierId`, `supplierName`, `supplierCnpj`, `installmentNumber`, `dueDate`, `amount` (`Decimal(15,2)`), `paymentMethod`, `status`, `source`, `paidAt`, timestamps | `Company`, `NfeEntry` (obrigatória, cascade), `Fornecedor`; única `nfeEntryId + installmentNumber`; índices `companyId + dueDate`, fornecedor e NF-e |
| `NfeEntry` | identificação, fornecedor, `entryStatus`, `financialStatus`, `totalAmount`, `riskScore`, `recommendation`, `validationSummary`, `financialGeneratedAt`, timestamps | documento fiscal, fornecedor, `payables`, `alerts`, `events`; única `companyId + accessKey` |
| `Fornecedor` | identificação, `condicaoPagamento`, `prazoMedioDias`, `banco`, `agencia`, `contaBancaria`, `chavePix`, `ativo`, timestamps | `nfeEntries`, `payables`; consultar, sem criar/alterar no ciclo |
| `FiscalAlert` | vínculo com NF-e/item/documento, `type`, `severity`, `title`, `message`, `recommendation`, `status`, datas | consulta de bloqueios fiscais; índice por empresa/status/data |
| `NfeEntryEvent` | `companyId`, NF-e, usuário, tipo, título, descrição, metadados e data | timeline imutável da NF-e; índices por NF-e/data e empresa/data |
| `AuditLog` | empresa/usuário opcionais, ação, entidade, IP, agente, metadados e data | base para auditoria futura; índice empresa/data |

`CteEntry` e tabelas contábeis não são origem de contas a pagar neste ciclo. O
`Payable` existente não suporta, por si só, boleto, contrato, NFS-e, CT-e ou lançamento
manual independente.

## APIs confirmadas

Todas as rotas estão sob o contexto de empresa e usam busca por `companyId`.

| Método e rota | Implementação confirmada |
| --- | --- |
| `GET /companies/:companyId/nfe-entry` | lista paginada e filtrável de NF-e de entrada |
| `GET /companies/:companyId/nfe-entry/:id` | detalhe contextualizado |
| `GET /companies/:companyId/nfe-entry/:id/xml` | XML associado |
| `GET /companies/:companyId/nfe-entry/:id/danfe` | DANFE associado |
| `POST /companies/:companyId/nfe-entry/:id/validate` | análise fiscal, alertas/evento e status |
| `POST /companies/:companyId/nfe-entry/:id/generate-payables` | valida parcelas, confere total, faz `upsert`, atualiza status financeiro e registra evento |

Arquivo: `apps/api-js/src/modules/nfe-entry/nfe-entry.routes.js`.

## Frontend confirmado

`apps/web/lib/services/nfe-entry-service.ts` já expõe `listNfeEntries`,
`getNfeEntry`, `validateNfeEntry`, `generateNfeEntryPayables`, `getNfeEntryXml` e
`getNfeEntryDanfe`. Todos usam o `companyId` de sessão e `apiFetch` em
`apps/web/lib/api.ts`.

A referência visual é `apps/web/components/nfe-entry/nfe-entry-view.tsx`: cartões
com ícone lime, filtros responsivos, tabela com `overflow-x-auto`, badges
`ok`/`warn`/`danger`/`muted`, queries e mutations TanStack, toast e detalhe lateral.
O menu existente aponta **Financeiro** para `/finance` em
`apps/web/components/app-shell.tsx`.

## Testes e comandos existentes

O backend fornece `prisma:validate`, `prisma:generate`, `test:db:migrate`,
`test`, `test:http`, `test:e2e` e preflights de Node, pnpm, Docker e banco de teste.
O frontend fornece `next build`, `eslint .` e `tsc --noEmit` por `pnpm build`,
`pnpm lint` e `pnpm typecheck`.

## Limitações encontradas

- Não há API própria de consulta ou baixa de `Payable`; qualquer uma depende de sprint
  posterior e da compatibilidade do schema atual.
- A baixa manual só é conceitualmente possível pelos campos existentes `status` e
  `paidAt`; não está implementada nesta baseline.
- Dados bancários do fornecedor são sensíveis e devem ser mascarados por padrão.
