# Homologação externa e preparação para produção

Este runbook não autoriza transmissão fiscal, cobrança, sincronização completa ou migration em produção.

## Inventário sem exposição de secrets

Execute `pnpm --filter @ns-fiscal/api-js env:status`. O relatório mostra somente nomes e presença. Os arquivos reais de homologação e produção devem existir fora do repositório ou ser materializados por um secret manager.

## Ordem de homologação

1. Criar banco e usuário com privilégios mínimos; validar backup restaurável.
2. Provisionar Redis com TLS e autenticação.
3. Configurar domínio, HTTPS, CORS exato, callbacks e webhooks.
4. Gerar chaves independentes para JWT, certificado e tokens de marketplace.
5. Configurar certificado A1 de empresa de teste.
6. Mercado Livre: OAuth, callback, conta de teste e amostra com no máximo 10 registros.
7. Shopee: somente após liberação oficial; manter bloqueada quando não liberada.
8. Providers fiscais: homologar NF-e, NFC-e, NFS-e por município, CT-e e MDF-e separadamente.
9. Sicoob: usar sandbox; não efetuar pagamento real.
10. FiscalAI: validar timeout, indisponibilidade e minimização de contexto.

## Deploy

```text
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @ns-fiscal/api-js prisma:generate
pnpm --filter @ns-fiscal/api-js build
pnpm --filter @ns-fiscal/web build
```

API: `pnpm --filter @ns-fiscal/api-js start`  
Web: `pnpm --filter @ns-fiscal/web start`  
Worker dedicado: `pnpm --filter @ns-fiscal/api-js worker:sync`

Configure restart policy no supervisor existente. O proxy deve terminar TLS e encaminhar o request ID. API, Web e worker devem usar os mesmos secrets versionados no secret manager.

## Migration de produção

1. Abrir janela de mudança e bloquear escritas.
2. Confirmar host, database, schema e usuário sem imprimir a URL.
3. Criar backup consistente e executar restauração de prova.
4. Executar `prisma migrate status` contra produção e registrar migrations pendentes.
5. Obter aprovação humana.
6. Executar `pnpm --filter @ns-fiscal/api-js prisma:deploy`.
7. Executar health, readiness e smoke somente leitura.
8. Liberar escrita após validação.

## Rollback

Não usar `migrate reset`, `db push` ou rollback SQL improvisado. Interromper escrita, restaurar o backup validado em uma nova instância/schema, apontar a aplicação para a restauração, reiniciar API/worker e repetir o smoke. Preservar logs e auditoria do incidente.

## Smoke não destrutivo

Defina `SMOKE_API_URL`, `SMOKE_WEB_URL` e, opcionalmente, `SMOKE_READONLY_TOKEN` e `SMOKE_COMPANY_ID`. Execute `pnpm --filter @ns-fiscal/api-js smoke:readonly`. O script usa somente GET e não cria, transmite, paga ou cancela registros.

## Bloqueios conhecidos antes do go-live

- Cookies de sessão ainda são gravados pelo frontend e não são `httpOnly`.
- O parâmetro de desenvolvimento `nsSession` no middleware web aceita material de sessão na URL.
- O rate limit atual é em memória e não é compartilhado entre réplicas.
- Health valida banco, mas a disponibilidade de Redis/worker precisa de monitoramento externo.
- NFS-e exige evidência por município/provedor; não há cobertura nacional presumida.
- Produção fiscal permanece bloqueada enquanto `ALLOW_PRODUCTION_SEFAZ=false`.
