# FiscalPay — governança do primeiro ciclo

O FiscalPay é o módulo de contas a pagar do Doxnira Fiscal. Esta documentação fixa a
baseline técnica da Sprint 00 e é a fonte de verdade para o início da Sprint 01.

## Limite do ciclo inicial

O ciclo usa `Payable` como entidade principal, sempre vinculada a uma `NfeEntry` da
mesma empresa. Pode consultar títulos, mostrar resumo/filtros/detalhe, mostrar dados
da NF-e e do fornecedor, alertas e timeline, e reutilizar a geração e validação já
existentes. Não cria schema, migration, integrações bancárias nem pagamento real.

## Recursos autorizados

- Tabelas: `Payable`, `NfeEntry`, `Fornecedor`, `FiscalAlert`, `NfeEntryEvent`,
  `AuditLog` e `FiscalDocument` somente nos limites descritos no inventário.
- APIs: listagem, detalhe, XML, DANFE, validação e geração de contas a pagar de
  NF-e de entrada.
- Frontend: a futura entrada é `/finance`, reutilizando `PageHeader`, `Card`,
  `Button`, `Input`, `notify`, TanStack Query e ícones Lucide.

## Documentos

- [Baseline e certificação](SPRINT-00-BASELINE-GOVERNANCA.md)
- [Inventário técnico](INVENTARIO-TECNICO.md)
- [Matriz de reuso](MATRIZ-REUSO.md)
- [Escopo congelado e ADRs](ESCOPO-CONGELADO.md)

## Sprints

| Sprint | Tema | Estado |
| --- | --- | --- |
| 00 | Baseline e governança | Aprovada com ressalva |
| 01 | API de consulta sobre `Payable` | Não iniciada |

> O primeiro ciclo não altera schema. Qualquer expansão de domínio exige decisão
> arquitetural e sprint própria.
