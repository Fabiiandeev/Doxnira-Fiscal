# Checklist de Validação NF‑e

Checklist executado pelo agente `fiscal-nfe-validator` em toda funcionalidade de NF‑e. Cada item deve ser verificado antes de considerar a implementação pronta.

## 1. Validação estrutural (todos os módulos)

- [ ] `npm run lint` passa sem erros.
- [ ] `npm run typecheck` passa sem erros.
- [ ] `npm run build` (Next.js + API) compila sem erros.
- [ ] Nenhuma dependência nova foi adicionada a `package.json`.

## 2. API Backend — arquivos críticos

### `src/services/nfe-validation/nfe-validation-engine.js`
- [ ] Todas as 12 fases executam sem exceção.
- [ ] Regras `EMIT‑001` a `EMIT‑010` (emitente) passam com CNPJ/IE/CRT/UF/IBGE válidos.
- [ ] Regras `DEST‑001` a `DEST‑009` (destinatário) tratam CPF, CNPJ, IE, isento, não contribuinte.
- [ ] Regras `PROD‑002` a `PROD‑011` (produtos) validam NCM 8 dígitos, CFOP 4 dígitos, unidade, origem.
- [ ] Regras `TRIB‑001` a `TRIB‑007` (tributação) distinguem CSOSN vs CST por CRT.
- [ ] Regras `TOT‑001` a `TOT‑010` (totais) batem soma de itens × totais declarados.
- [ ] `applyAutoCorrections` não quebra dados reais; retorna diff legível.

### `src/services/fiscal-xml-parser.service.js`
- [ ] Parse de NF‑e (modelo 55) extrai todos os campos obrigatórios (ide, emit, dest, det, total).
- [ ] Campos opcionais (transp, cobr) não causam erro quando ausentes.
- [ ] Namespace correto: `http://www.portalfiscal.inf.br/nfe`.
- [ ] Parse de CT‑e (modelo 57) quando presente.

### `src/utils/nfe-access-key.js`
- [ ] Valida chave de 44 dígitos.
- [ ] Dígito verificador calculado corretamente (módulo 11).
- [ ] Extrai UF, ano, mês, CNPJ, modelo, série, número da chave.
- [ ] Rejeita chave com caracteres não numéricos.

### `src/services/xml-signature.service.js`
- [ ] Assina XML de eventos (manifestação) com certificado A1.
- [ ] Referência à `infEvento` correta.
- [ ] Algoritmo: `http://www.w3.org/2000/09/xmldsig#rsa-sha1`.

### `src/services/sefaz-real.service.js`
- [ ] SOAP envelope `NFeDistribuicaoDFe` montado corretamente.
- [ ] Parse da resposta extrai `docZip` e classifica documentos.
- [ ] NSU window respeitado (137–656).
- [ ] Timeout e retry configurados.

### `src/services/sefaz-gateway.service.js`
- [ ] Roteia para mock quando `SEFAZ_INTEGRATION_ENABLED !== 'true'`.
- [ ] Roteia para real quando `SEFAZ_INTEGRATION_ENABLED === 'true'`.

### `src/services/manifestation-real.service.js`
- [ ] XML do evento de manifestação (`210200` confirmação, `210210` desconhecimento, `210220` não realizada) construído corretamente.
- [ ] SOAP submetido para `NFeRecepcaoEvento4`.

## 3. Lógica fiscal — CFOP / CST / Impostos

### `src/services/fiscal-ai/engines/cfop-engine.js`
- [ ] CFOP interno (5xxx) para UF emitente = UF destinatário.
- [ ] CFOP interestadual (6xxx) para UF emitente ≠ UF destinatário.
- [ ] Operação de devolução mapeia para 1202/2202/5202/6202 conforme direção.
- [ ] Operação de venda mapeia para 5102/6102 (revenda) ou 5101/6101 (produção própria).
- [ ] Exportação mapeia para 7xxx.

### `src/services/fiscal-ai/engines/cst-csosn-engine.js`
- [ ] CRT = 1 (Simples Nacional) → usa CSOSN (101–900).
- [ ] CRT = 3 (Regime Normal) → usa CST (00–90).
- [ ] Não mistura CSOSN e CST no mesmo item.

### `src/services/fiscal-ai/engines/incidence-engine.js`
- [ ] ICMS incidência calculada conforme operação e UF.
- [ ] ST (substituição tributária) detectada quando CEST e MVA declarados.
- [ ] DIFAL calculado para operações interestaduais com consumidor final não contribuinte.
- [ ] FCP adicionado quando UF destino possui alíquota FCP.

### `src/services/fiscal-ai/engines/nfe-rules-validation-engine.js`
- [ ] `NFE_SIMPLES_ICMS_POSITIVO` bloqueia ICMS > 0 no Simples (regra geral — exceto quando permitido por exceção legal).
- [ ] `NFE_SIMPLES_CST_INSTEAD_CSOSN` bloqueia CST em empresa do Simples.
- [ ] `NFE_NORMAL_CSOSN_INSTEAD_CST` bloqueia CSOSN em empresa do Regime Normal.
- [ ] `NFE_ST_SEM_CEST_MVA` alerta ST sem CEST/MVA.

### `src/services/tax-calculation.service.js`
- [ ] Cálculo do ICMS próprio: base × alíquota.
- [ ] Cálculo do ICMS‑ST: (base + MVA%) × alíquota interna − ICMS próprio.
- [ ] PIS/COFINS cumulativo vs não cumulativo conforme regime da empresa.
- [ ] IPI: base × alíquota TIPI.

## 4. Banco de dados — Prisma

### `apps/api-js/prisma/schema.prisma`
- [ ] Modelo `NfeDocument` contém todos os campos obrigatórios do layout da NF‑e.
- [ ] Modelo `NfeItem` indexado por `nfeDocumentId`.
- [ ] Modelo `NfeTotal` vinculado 1:1 com `NfeDocument`.
- [ ] Modelo `NfeValidationResult` vinculado a `NfeValidationRun`.
- [ ] Índices em `chaveAcesso`, `cnpjEmitente`, `cnpjDestinatario`, `createdAt`.
- [ ] Migration aplicada (`pnpm --filter @ns-fiscal/api-js prisma:validate`).
- [ ] Seed de CFOPs carregado (400+ códigos).

## 5. Frontend — páginas e componentes

### `apps/web/app/(app)/emitir-nota/page.tsx` + `components/emitir-nota/emitir-nota-view.tsx`
- [ ] Integração com API real (não mock).
- [ ] Step 1 (Dados da nota): empresa, série, número, data, ambiente carregados do backend.
- [ ] Step 2 (Produtos): busca NCM, CFOP, unidade do serviço de produtos.
- [ ] Step 3 (Impostos): cálculo exibido com base no regime e CFOP.
- [ ] Step 4 (Revisão): totais batem.
- [ ] Step 5 (Emissão): chamada ao endpoint de autorização (quando implementado).

### `apps/web/app/(app)/nfe-validation/page.tsx` + `components/nfe-validation/nfe-validation-view.tsx`
- [ ] Lista validações do endpoint `GET /api/nfe-validation`.
- [ ] Exibe issues por fase com código da regra e severidade.
- [ ] Botão "Auto‑corrigir" chama `POST /api/nfe-validation/:runId/auto-correct`.
- [ ] Score e probabilidade de rejeição exibidos.

### `apps/web/app/(app)/xml-center/page.tsx` + `components/xml-center/xml-center-view.tsx`
- [ ] Substituir dados mock por chamada à API real de documentos fiscais.
- [ ] Exibir chave de acesso, emitente, destinatário, valor, data.
- [ ] Download do XML assinado via API.

### `apps/web/app/(app)/rejections/page.tsx` + `components/rejections/rejections-view.tsx`
- [ ] Substituir dados mock por chamada real a rejeições registradas.
- [ ] Exibir código SEFAZ, descrição, sugestão de correção.

### `apps/web/app/(app)/documents/page.tsx` + componentes relacionados
- [ ] Filtro por chave de acesso funciona.
- [ ] Filtro por CNPJ emitente/destinatário funciona.
- [ ] Diferenciação NF‑e entrada × saída.
- [ ] Manifestação (confirmação/desconhecimento/não realizada) funcional.

## 6. API Routes — endpoints

### `POST /api/nfe-validation`
- [ ] Aceita JSON ou XML no body.
- [ ] Retorna `runId` e `score`.
- [ ] Issues retornadas com código, fase, severidade, mensagem em português.

### `GET /api/nfe-validation`
- [ ] Lista validações com paginação.
- [ ] Filtro por status, score range.

### `GET /api/nfe-validation/:runId`
- [ ] Retorna validação completa com todas as issues.

### `POST /api/nfe-validation/:runId/auto-correct`
- [ ] Aplica correções automáticas seguras.
- [ ] Retorna diff de alterações.
- [ ] Gera nova validação após correção.

## 7. Segurança fiscal

- [ ] Certificado A1 nunca é logado ou versionado.
- [ ] Senha do certificado nunca aparece em logs.
- [ ] Chave de acesso mascarada em logs (`#### #### #### #### #### #### #### #### #### #### ####`).
- [ ] XML transmitido ao SEFAZ não é salvo em disco sem criptografia.
- [ ] `.env` com URLs/credenciais SEFAZ não versionado.

## 8. Testes automatizados

- [ ] Testes para `nfe-validation-engine.js` — todas as fases.
- [ ] Testes para `nfe-access-key.js` — chave válida, inválida, dígito verificador.
- [ ] Testes para `fiscal-xml-parser.service.js` — NF‑e modelo 55 completo.
- [ ] Testes para `cfop-engine.js` — todos os cenários de direção e operação.
- [ ] Testes para `cst-csosn-engine.js` — Simples × Normal.
- [ ] Testes para `tax-calculation.service.js` — ICMS, ST, PIS, COFINS, IPI.
- [ ] Testes para `incidence-engine.js` — DIFAL, FCP, ST.
- [ ] Testes para `nfe-rules-validation-engine.js` — todas as regras NFE_*.

Consulte `docs/qa/fiscal-nfe-test-scenarios.md` para cenários detalhados.