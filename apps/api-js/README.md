# NS Fiscal Cloud API

Backend JavaScript do NS Fiscal Cloud. A API usa Express, Prisma, PostgreSQL,
Redis e BullMQ. Nesta fase, toda sincronização fiscal é simulada e nenhuma
requisição real é enviada à SEFAZ.

## Requisitos

- Node.js 20.19 ou superior
- PostgreSQL 16
- Redis 7

## Configuração

```bash
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm prisma:deploy
pnpm prisma:seed
pnpm dev
```

API: `http://localhost:3333/api`

Health check: `GET /api/health`

Credenciais do seed:

- E-mail: `admin@nssistemas.com.br`
- Senha: `123456`

## Segurança

- Rotas privadas protegidas por JWT.
- Acesso aos dados sempre validado por empresa.
- Certificados PFX/P12 e senhas são criptografados com AES-256-GCM.
- Arquivo e senha do certificado nunca são retornados pela API.
- Logs removem autorização, cookies, senhas e certificados.

## Integração fiscal

`SEFAZ_INTEGRATION_ENABLED=false` mantém o gateway em modo mock. O arquivo
`sefaz-real.service.js` existe apenas como limite arquitetural e não realiza
chamadas externas nesta fase.

Backend JavaScript do NS Fiscal Cloud. Esta entrega cobre somente:

1. aplicação Express em `apps/api-js`;
2. Prisma conectado ao PostgreSQL;
3. middlewares globais;
4. health check em `GET /api/health`.

Auth, empresas, dashboard, documentos, filas, certificados, alertas e
manifestações não fazem parte desta etapa.

## Requisitos

- Node.js 20.19 ou superior;
- pnpm 11;
- PostgreSQL 16, local ou via Docker.

O repositório inclui `.nvmrc` com Node.js 24.14.0:

```bash
nvm use
corepack enable
```

## Configuração

```bash
cp .env.example .env
# Substitua `change-me-local` por uma senha local antes de continuar.
pnpm install
pnpm prisma:generate
```

Para iniciar o PostgreSQL pelo arquivo Compose:

```bash
pnpm db:up
```

Depois, aplique as migrations:

```bash
pnpm prisma:deploy
```

## Executar

```bash
pnpm dev
```

A API fica disponível em `http://localhost:3333`.

## Health check

```bash
curl http://localhost:3333/api/health
```

Com o PostgreSQL disponível:

```json
{
  "status": "ok",
  "service": "NS Fiscal Cloud API",
  "database": "connected",
  "timestamp": "2026-06-18T12:00:00.000Z"
}
```

Sem conexão com o banco, o endpoint retorna HTTP `503` e
`"database": "disconnected"`.
