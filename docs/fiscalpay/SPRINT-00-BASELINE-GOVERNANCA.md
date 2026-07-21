# Certificação — FiscalPay Sprint 00

## Repositório

- Branch: `feature/fiscalpay-s00-baseline-governance`
- Origem: `master`
- SHA inicial: `7f5e47cb8e9b102dc0c941a3a4bb3484af93df74`
- SHA final: `6cc792627c022ddaafded014efb0b9a92e7e47a4`
- Tag de baseline: `fiscalpay-s00-baseline-20260720`
- Remote: `origin` (`https://github.com/Fabiiandeev/Doxnira-Fiscal.git`)
- Data: 20 de julho de 2026

As alterações de MDF-e encontradas antes da execução foram preservadas no stash local
`wip/mdfe-before-fiscalpay-s00`; não fazem parte desta branch.

## Ambiente

- Node `v24.15.0` (requisito: `>=20.19`)
- pnpm `11.8.0`
- Docker `29.3.1`; Docker Compose `v5.1.1`
- Prisma `7.8.0`
- Banco de teste detectado: `ns_fiscal_cloud_test` (host omitido)
- Migrations existentes: de `20260618160000_init` a `20260720133000_add_mdfe_backend_foundation`

## Governança externa

- Branch `feature/fiscalpay-s00-baseline-governance`: publicada.
- Tag `fiscalpay-s00-baseline-20260720`: publicada apontando para `7f5e47c`.
- Pull request: pendente de abertura manual.
- Milestone, labels e proteção da `master`: não alterados nesta sprint.

## Arquivos desta sprint

- `README.md` (link documental)
- `docs/fiscalpay/README.md`
- `docs/fiscalpay/INVENTARIO-TECNICO.md`
- `docs/fiscalpay/MATRIZ-REUSO.md`
- `docs/fiscalpay/ESCOPO-CONGELADO.md`
- este arquivo e o template de PR FiscalPay

## Certificação técnica

| Comando | Resultado | Evidência |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Aprovado | lockfile inalterado |
| preflight Node/pnpm/Docker/banco | Aprovado | ambiente e banco de teste validados |
| `prisma:validate` | Aprovado | schema válido |
| `prisma:generate` | Aprovado | Prisma Client 7.8.0 gerado |
| `test:db:migrate` | Aprovado | 27 migrations, nenhuma pendente |
| `test` | Falhou (preexistente) | 34 passaram; 1 falhou por import nomeado ESM de módulo CommonJS no Node 24 |
| `test:http` | Aprovado | 1 teste HTTP E2E passou |
| `test:e2e` | Aprovado | suites de NF-e, CT-e e contabilidade passaram |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | Aprovados | ESLint, `tsc --noEmit` e Next build concluídos |
| `BUILD_ID` | Aprovado | `vHTNq6KwfQL1m7kUuK4sq` |

## Status

**APROVADA COM RESSALVA.** O único gate não aprovado é preexistente e não foi corrigido
por estar fora do escopo documental: `test/unit/preflight-checks.unit.test.js` importa
`_internal` como export nomeado de `scripts/preflight-checks.cjs`, incompatível com o
carregamento CommonJS observado no Node `v24.15.0`. Não houve schema, migration, rota
de produção, componente de runtime, dependência ou workflow alterado.
