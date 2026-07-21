# Escopo congelado — FiscalPay

## Permitido no primeiro ciclo

- Consulta contextualizada de `Payable`, resumo, filtros e detalhe.
- Dados da NF-e, fornecedor, alertas fiscais e timeline.
- Reuso de geração por NF-e e validação existentes.
- Baixa manual futura exclusivamente pelos campos existentes `status` e `paidAt`.
- Auditoria de ações futuras e tratamento de isolamento por empresa.

## Proibido no primeiro ciclo

- Aprovação em níveis, boleto, OCR, Pix, pagamento bancário, webhook, Open Finance ou conciliação.
- Conta contábil, centro de custo, CT-e/NFS-e a pagar e lançamento sem NF-e.
- Dados mock, nova tela/componente nesta sprint, endpoint, migration ou alteração de schema.

## Decisões do primeiro ciclo

### ADR-001 — Base financeira existente

O primeiro ciclo utiliza `Payable` como título financeiro, sempre vinculado a uma
`NfeEntry`. Não haverá múltiplas origens sem alteração futura e explicitamente
autorizada do schema.

### ADR-002 — Isolamento por empresa

Toda consulta e mutação deverá usar o `companyId` obtido do contexto autenticado. Não
será aceito `companyId` fornecido livremente no body.

### ADR-003 — Reutilização

Validação, geração de contas, XML e DANFE deverão reutilizar as APIs existentes de
NF-e de entrada. Não serão criados endpoints duplicados.

### ADR-004 — UI existente

O frontend deverá utilizar a rota `/finance` e o padrão visual atual do sistema, sem
redesign ou criação de novo design system.

## Frontend autorizado

A entrada existente do módulo Financeiro é `/finance`.

A implementação deverá reutilizar `PageHeader`, `Card`, `Button`, `Input`, `notify`,
TanStack Query, a tabela e o painel lateral de NF-e Entrada, além dos badges `ok`,
`warn`, `danger` e `muted`.

A organização definitiva dos arquivos será confirmada na Sprint 02 por inspeção da
estrutura atual. Não serão criados placeholders ou diretórios antecipados na Sprint 00.
