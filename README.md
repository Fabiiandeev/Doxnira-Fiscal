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
