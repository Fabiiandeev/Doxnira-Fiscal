# NS Fiscal Cloud

Base visual do sistema fiscal da NS Sistemas, construída a partir da documentação
técnica de sincronização NF-e e da especificação complementar de UX/UI.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS e componentes no padrão shadcn/ui
- TanStack Query e TanStack Table
- Recharts
- Prisma/PostgreSQL (schema inicial)

## Executar

```bash
corepack pnpm install
corepack pnpm dev
```

Acesse `http://localhost:3000/login`.

## Escopo desta fase

- Login visual e onboarding inicial
- AppShell responsivo
- Dashboard fiscal com mocks realistas
- Busca e filtros de documentos fiscais
- Detalhe da NF-e com XML sanitizado e auditoria
- Sincronização com estados NSU/cStat mockados
- Certificado digital sem exposição de dados sensíveis
- Schema Prisma principal e tabelas complementares de UX

Nenhuma chamada real à SEFAZ é feita nesta fase. A camada de serviço mockada fica
isolada em `apps/web/lib/services` para futura substituição pelo backend NestJS.

## Ambiente de certificação local (Sprint 02.5)

O backend `apps/api-js` precisa de um PostgreSQL isolado para os testes HTTP e E2E.
Este repositório oferece um `docker-compose.yml` novo (sem `container_name`) que
provisiona um PostgreSQL 16 efêmero, paralelo a quaisquer containers locais
pré-existentes (por exemplo `doxnira-postgres`). O compose **não** remove, recria
ou reutiliza containers externos.

### Pré-requisitos

- Node.js >= 20.19
- pnpm >= 11 (ative via `corepack enable && corepack prepare pnpm@latest --activate`)
- Docker (Docker Desktop no Windows/macOS ou daemon Docker no Linux)

### Configurar credenciais locais (sem versionar)

1. Copie os templates (nunca commite seus `.env` locais):

   ```bash
   # raiz do repositório
   cp .env.docker.example .env.docker
   # backend
   cp apps/api-js/.env.test.example apps/api-js/.env.test
   ```

2. Gere uma senha local forte **sem** registrá-la em logs, commits ou notas:

   ```bash
   # Linux/macOS/Windows (Git Bash)
   openssl rand -base64 24
   # PowerShell (alternativa)
   -join ((48..122) | Get-Random -Count 24 | ForEach-Object {[char]$_})
   ```

3. Edite `.env.docker` e `apps/api-js/.env.test` substituindo todos os
   placeholders `CHANGE_ME_*` e `replace-me-*` pelos valores gerados localmente.
   Mantenha o mesmo `POSTGRES_PASSWORD` em `.env.docker` e na senha do
   `DATABASE_URL_TEST` em `apps/api-js/.env.test`.

4. Se uma porta diferente de 5432 for necessária, ajuste `POSTGRES_PORT` em
   `.env.docker` e a porta em `DATABASE_URL_TEST` em `apps/api-js/.env.test`.

### Bootstrap — Windows (PowerShell)

```powershell
corepack enable
pnpm install
pnpm --filter @ns-fiscal/api-js db:up
pnpm --filter @ns-fiscal/api-js prisma:generate
pnpm --filter @ns-fiscal/api-js test:db:migrate
```

### Bootstrap — macOS / Linux

```bash
corepack enable
pnpm install
pnpm --filter @ns-fiscal/api-js db:up
pnpm --filter @ns-fiscal/api-js prisma:generate
pnpm --filter @ns-fiscal/api-js test:db:migrate
```

### Subir / parar / verificar o banco

```bash
pnpm --filter @ns-fiscal/api-js db:up      # sobe o postgres do compose novo
pnpm --filter @ns-fiscal/api-js db:status  # docker compose ps
pnpm --filter @ns-fiscal/api-js db:logs    # últimos 200 linhas de log
pnpm --filter @ns-fiscal/api-js db:down    # derruba sem remover o volume
```

Se a porta configurada estiver em uso, `db:up` aborta antes de chamar o Docker e
indica como prosseguir (trocar `POSTGRES_PORT` em `.env.docker` ou parar
manualmente o container que ocupa a porta). Ele nunca para, recria ou reutiliza
o container legado `doxnira-postgres`.

### Executar certificação

```bash
# preflight isolado (válida Node, pnpm, Docker, DATABASE_URL_TEST e client Prisma)
pnpm --filter @ns-fiscal/api-js preflight:e2e

# HTTP + E2E
pnpm --filter @ns-fiscal/api-js test:http
pnpm --filter @ns-fiscal/api-js test:e2e

# front-end
pnpm lint
pnpm typecheck
pnpm build
test -s apps/web/.next/BUILD_ID   # Linux/macOS
Test-Path apps/web/.next/BUILD_ID  # PowerShell
```

### Rotação de senha local (procedimento)

Este procedimento **não** exibe a senha atual nem a nova senha em hipótese
alguma. Execute localmente, sem registrar os valores no commit, em logs ou em
capturas de tela:

1. Gere uma nova senha local (ex.: `openssl rand -base64 24`).
2. Atualize `POSTGRES_PASSWORD` em `.env.docker` e o segmento da senha em
   `DATABASE_URL_TEST` de `apps/api-js/.env.test`.
3. Se o volume já existir e continuar carregando a senha antiga, decida entre:
   - recriar o volume (destrutivo, sob sua responsabilidade — use
     `docker compose --env-file .env.docker down` seguido de remoção manual do
     volume, **fora** deste repositório); ou
   - usar um novo `POSTGRES_DB` em `.env.docker` para iniciar um banco limpo.
4. Rode novamente `db:up`, `prisma:generate`, `test:db:migrate` e os gates.

Pendência operacional obrigatória: rotacionar periodicamente as credenciais
locais e nunca reusá-las em ambientes compartilhados, CI ou produção.

### CI (build-certification.yml)

O workflow `.github/workflows/build-certification.yml` provisiona um PostgreSQL
16 efêmero via `services:` do GitHub Actions. As credenciais de CI são
efêmeras, definidas apenas no workflow, e **não** dependem de `.env.test`
local. O workflow executa `prisma:validate`, `prisma:generate`,
`test:db:migrate`, `preflight:e2e`, testes HTTP/E2E (2x), lint, typecheck,
build e checa `apps/web/.next/BUILD_ID`.

### Limitações

- O compose novo **não** monitona, derruba nem reutiliza containers legados.
- Não há comando destrutivo automatizado (sem `-v` em `db:down`).
- Rotação real de credenciais locais é operacional e manual; o repositório só
  provê templates e documentação do procedimento.
- Migrations são aplicadas exclusivamente ao banco de teste em gates locais e
  no CI; nenhuma migração toca ambientes de produção ou o Supabase remoto.

