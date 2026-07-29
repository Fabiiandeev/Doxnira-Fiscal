# Certificação técnica — MDF-e deploy controlado no Supabase

Data da execução: 2026-07-29

Etapa: `MDFE-DEPLOY-01`

Status: `DATABASE_DEPLOYED_READY_FOR_HOMOLOGATION`

## Autorização e escopo

- A declaração `AUTORIZO A ESCRITA CONTROLADA NO SUPABASE` foi recebida antes
  de qualquer escrita externa.
- A execução foi limitada à reconciliação do histórico, aplicação das
  migrations já certificadas e validações de schema, dados e RLS.
- Nenhum commit, reset, exclusão de dados, transmissão fiscal, alteração de
  certificado ou reinício do FiscalAI foi executado.

## Alvo e backup

- Supabase: projeto mascarado `dcjs***fksi`, database `postgres`, schema
  `public`, PostgreSQL 17.6.
- Backup lógico verificado:
  `C:\Users\thall\AppData\Local\DoxniraFiscal\backups\supabase\dcjs-fksi\20260729T171658\public.dump`.
- Formato custom/comprimido, 347981 bytes.
- SHA-256:
  `b5857f309f13a3c96951330ad5d08e625e3ccde9bf9bc596e550276b7643151a`.
- A restauração havia sido comprovada em PostgreSQL 17.10 e o arquivo não foi
  movido nem sobrescrito.

## Reconciliação do histórico

- `20260713090000_align_products_with_prisma_schema`: equivalência mantida para
  32/32 colunas e o índice `products_company_id_ncm_idx`. O registro falho
  42701 foi preservado como rolled back e a migration foi resolvida como
  aplicada pelo mecanismo oficial do Prisma.
- `20260717220000_sync_company_tax_settings`: equivalência mantida para 37/37
  colunas, defaults, nulabilidade e ausência de nulos nos campos obrigatórios.
  A migration foi resolvida como aplicada pelo Prisma.
- Nenhum SQL estrutural equivalente foi reaplicado e o histórico não foi
  editado manualmente.

## Deploy

- Comando de produção: `prisma migrate deploy`.
- 25 migrations pendentes aplicadas sequencialmente em 53,7 segundos.
- As migrations MDF-e aplicadas foram:
  - `20260720133000_add_mdfe_backend_foundation`
  - `20260729153000_complete_mdfe_module`
  - `20260729160000_mdfe_automatic_from_nfe`
  - `20260729200000_mdfe_hardening_establishments_drivers`
  - `20260729203000_fix_fleet_vehicle_plate_check`
- Estado final: 45 migrations distintas aplicadas, zero pendências e zero
  falhas ativas.

## Estrutura e dados

- Supabase final: 166 tabelas, 592 constraints e 669 índices.
- Índices inválidos: 0.
- Constraints inválidas: 0.
- A comparação semântica de 2582 colunas, 592 constraints, 669 índices, RLS e
  policies entre o banco local e o Supabase não encontrou diferenças.
- A tabela e os enums locais `marketing_leads` foram excluídos da comparação
  porque são artefatos locais de teste e não pertencem ao Prisma ou às 45
  migrations.
- Dados preservados: 21 empresas, um certificado e 42 NF-e.
- Backfill: 21 estabelecimentos matriz, nenhuma empresa sem matriz, nenhuma
  matriz duplicada e nenhum estabelecimento órfão.
- Certificado permaneceu criptografado e vinculado à empresa.

## RLS e isolamento

- 30 policies `tenant_company_isolation` presentes.
- 40 tabelas com RLS habilitado.
- Cenário A: leitura própria permitida.
- Cenário B: leitura cruzada retornou zero registros.
- Cenário C: inserção cruzada bloqueada com PostgreSQL 42501.
- Cenário D: alterações cruzadas em condutor, estabelecimento, veículo e
  configuração retornaram zero registros alterados.
- Cenário E: vínculo fiscal cruzado bloqueado com PostgreSQL 42501.
- Todos os fixtures foram executados em transação e revertidos; nenhum dado de
  teste permaneceu.

## Funcional externo

- Resolução da matriz e da filial: aprovada.
- Veículo e condutor padrão global: aprovados.
- Veículo e condutor padrão por estabelecimento: aprovados.
- Elegibilidade com atribuição automática da matriz: aprovada.
- Histórico de elegibilidade: aprovado.
- Idempotência de elegibilidade: aprovada.
- Escopos de reprocessamento por NF-e, estabelecimento, período e status:
  aprovados.
- Idempotência do evento NF-e autorizado: aprovada por constraint única.
- Reserva de NF-e: aprovada.
- Bloqueio de reserva concorrente: aprovado.
- Auditoria: aprovada.
- Todos os registros funcionais temporários foram revertidos.

## Certificado e SVRS

- Certificado A1 preservado, criptografado, validado e vigente.
- Empresa configurada para homologação.
- Consulta de status real por mTLS após o deploy:
  HTTP 200, `cStat=107`, `xMotivo=Servico em Operacao`, 203 ms.
- Produção permaneceu bloqueada.
- Nenhuma NF-e ou MDF-e foi transmitida.

## Regressão pós-deploy

- Prisma validate: aprovado.
- Prisma generate: aprovado.
- Status Prisma: 45 migrations, banco atualizado.
- Testes MDF-e: 28/28.
- Testes hardening: 6/6.
- Suíte unitária: 82/82.
- Suíte legada/E2E: 43/43.
- Teste RLS local: 1/1.
- API lint/build: aprovados.
- Web lint/typecheck/build: aprovados.
- Git diff check: aprovado.

## FiscalAI

- Runtime: `PAUSED_SECURITY_ROTATION_REQUIRED`.
- Nenhum container RAG foi reiniciado.
- A revogação da chave anteriormente exposta no portal NVIDIA continua sendo
  uma ação externa separada.

## Próxima etapa

`MDFE-HOMOLOG-01` — obter NF-e autorizada em homologação, comprovar o
credenciamento MDF-e e executar os cenários H01–H06.
