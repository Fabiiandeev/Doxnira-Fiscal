# Matriz de reuso — FiscalPay

| Necessidade | Recurso existente | Arquivo | Ação futura |
| --- | --- | --- | --- |
| Listar contas | `Payable` | `apps/api-js/prisma/schema.prisma` | Criar consulta contextualizada |
| Gerar parcelas | `generate-payables` | `apps/api-js/src/modules/nfe-entry/nfe-entry.routes.js` | Reutilizar |
| Validar NF-e | `validate` | `apps/api-js/src/modules/nfe-entry/nfe-entry.routes.js` | Reutilizar |
| Abrir XML | `getNfeEntryXml` | `apps/web/lib/services/nfe-entry-service.ts` | Reutilizar |
| Abrir DANFE | `getNfeEntryDanfe` | `apps/web/lib/services/nfe-entry-service.ts` | Reutilizar |
| Dados do fornecedor | `Fornecedor` | `apps/api-js/prisma/schema.prisma` | Somente leitura, mascarada quando aplicável |
| Alertas fiscais | `FiscalAlert` | `apps/api-js/prisma/schema.prisma` | Consultar como bloqueio/sinalização |
| Timeline | `NfeEntryEvent` | schema e rota de NF-e | Reutilizar |
| Auditoria | `AuditLog` | schema e serviço de auditoria | Registrar ação futura |
| Cards, filtros e tabela | `Card`, `Input`, `Button`, view NF-e | `apps/web/components/nfe-entry/nfe-entry-view.tsx` | Reutilizar padrão |
| Notificação | `notify` | `apps/web/components/toast-viewport.tsx` | Reutilizar |
| Dados e cache | TanStack Query / `apiFetch` | `apps/web/lib/api.ts` | Reutilizar com query keys próprias |

Nenhum item desta matriz autoriza alterar schema, criar endpoint ou componente na
Sprint 00.
