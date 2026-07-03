# Cenários de Teste — NF‑e

Cenários para guiar a criação de testes automatizados (Jest/Vitest + Playwright E2E) das funcionalidades de NF‑e. Baseados nos módulos reais em `apps/api-js/src/services/` e `apps/web/`.

## TC‑1: Chave de Acesso

**Arquivo alvo:** `src/utils/nfe-access-key.js`

| ID | Cenário | Entrada | Esperado |
|----|---------|---------|----------|
| ACC‑01 | Chave válida | 44 dígitos com DV correto | `{ valid: true, uf, anoMes, cnpj, modelo, serie, numero }` |
| ACC‑02 | Chave inválida — tamanho | 43 dígitos | `{ valid: false, error: 'CHAVE_LENGTH' }` |
| ACC‑03 | Chave inválida — DV errado | 44 dígitos, último dígito trocado | `{ valid: false, error: 'CHAVE_CHECK_DIGIT' }` |
| ACC‑04 | Chave com caractere não numérico | contém letra | `{ valid: false, error: 'CHAVE_NON_NUMERIC' }` |

## TC‑2: Parsing de XML Fiscal

**Arquivo alvo:** `src/services/fiscal-xml-parser.service.js`

| ID | Cenário | Entrada | Esperado |
|----|---------|---------|----------|
| XML‑01 | NF‑e completa (modelo 55) | XML com todos os campos obrigatórios | Objeto NFeDocument completo com ide, emit, dest, det[], total |
| XML‑02 | NF‑e sem transporte | XML sem tag `<transp>` | Parse OK, transp = null |
| XML‑03 | NF‑e com item único | 1 `<det>` | Array items com 1 elemento |
| XML‑04 | NF‑e com 50 itens | 50 `<det>` | Array items com 50 elementos, todos com NCM/CFOP |
| XML‑05 | NF‑e com IPI | `<IPI>` presente nos itens | IPI extraído por item |
| XML‑06 | NF‑e com ST | `<ICMSST>` presente | ICMS ST extraído |
| XML‑07 | XML inválido (malformed) | XML com tag não fechada | Erro de parse tratado |
| XML‑08 | Namespace incorreto | Namespace ≠ portal fiscal | Erro de namespace |
| XML‑09 | NF‑e Simples Nacional | CSOSN nos itens | CSOSN extraído, sem CST |

## TC‑3: Validação — Emitente

**Arquivo alvo:** `src/services/nfe-validation/nfe-validation-engine.js` (fase Emitente)

| ID | Cenário | Entrada | Issue esperada |
|----|---------|---------|----------------|
| EMIT‑01 | CNPJ válido | 14 dígitos, DV OK | Nenhum erro |
| EMIT‑02 | CNPJ inválido (DV) | 14 dígitos, último trocado | EMIT‑001 |
| EMIT‑03 | IE vazia para contribuinte | IE = '', CRT = 3 | EMIT‑002 |
| EMIT‑04 | CRT inválido | CRT = 99 | EMIT‑003 |
| EMIT‑05 | CRT Simples + IE preenchida | CRT = 1, IE preenchida | EMIT‑004 |
| EMIT‑06 | Razão social vazia | xNome = '' | EMIT‑005 |
| EMIT‑07 | UF inválida | UF = 'XX' | EMIT‑006 |
| EMIT‑08 | UF emitente × UF autorizadora divergentes | emit UF = 'SP', ambiente UF = 'MG' | AMB‑002 |
| EMIT‑09 | IBGE inválido para UF | UF = 'SP', IBGE = '3304557' (Rio) | EMIT‑009 |
| EMIT‑10 | CNPJ com zeros à esquerda | '00123456000199' (DV falso) | EMIT‑001 |

## TC‑4: Validação — Destinatário

**Arquivo alvo:** `src/services/nfe-validation/nfe-validation-engine.js` (fase Destinatario)

| ID | Cenário | Entrada | Issue esperada |
|----|---------|---------|----------------|
| DEST‑01 | CNPJ destinatário válido | CNPJ 14 dígitos, IE preenchida | Nenhum erro |
| DEST‑02 | CPF destinatário válido | CPF 11 dígitos, indIEDest = 9 | Nenhum erro |
| DEST‑03 | Destinatário contribuinte sem IE | CNPJ válido, IE = '', indIEDest = 1 | DEST‑009 |
| DEST‑04 | Destinatário isento com IE | IE preenchida, indIEDest = 2 | DEST‑009 |
| DEST‑05 | Consumidor final estrangeiro | idEstrangeiro preenchido | Nenhum erro (sem CNPJ/CPF) |
| DEST‑06 | UF destinatário inválida | UF = 'XX' | DEST‑007 |
| DEST‑07 | Nome destinatário vazio | xNome = '' | DEST‑006 |

## TC‑5: Validação — Produtos

**Arquivo alvo:** `src/services/nfe-validation/nfe-validation-engine.js` (fase Produtos)

| ID | Cenário | Entrada | Issue esperada |
|----|---------|---------|----------------|
| PROD‑01 | NCM válido 8 dígitos | '84713019' | Nenhum erro |
| PROD‑02 | NCM 7 dígitos | '8471301' | PROD‑002 |
| PROD‑03 | NCM vazio | '' | PROD‑003 |
| PROD‑04 | CFOP válido interno | '5102' (emit SP, dest SP) | Nenhum erro |
| PROD‑05 | CFOP 3 dígitos | '510' | PROD‑004 |
| PROD‑06 | CFOP 5xxx para interestadual | '5102' (emit SP, dest RJ) | TRIB‑007 |
| PROD‑07 | CFOP 6xxx para interno | '6102' (emit SP, dest SP) | TRIB‑006 |
| PROD‑08 | Produto sem descrição | xProd = '' | PROD‑006 |
| PROD‑09 | Quantidade zero | qCom = 0 | PROD‑007 |
| PROD‑10 | Valor unitário zero | vUnCom = 0 | PROD‑008 |
| PROD‑11 | qCom × vUnCom ≠ vProd | 10 × 5,50 = 55,00 mas vProd = 50,00 | PROD‑009 |
| PROD‑12 | Origem inválida | orig = 9 (máx 8) | PROD‑011 |

## TC‑6: Validação — Totais

**Arquivo alvo:** `src/services/nfe-validation/nfe-validation-engine.js` (fase Totais)

| ID | Cenário | Entrada | Issue esperada |
|----|---------|---------|----------------|
| TOT‑01 | Totais batem | soma itens = total declarado | Nenhum erro |
| TOT‑02 | Produtos não batem | vProd declarado ≠ soma itens | TOT‑001 |
| TOT‑03 | ICMS não bate | vICMS declarado ≠ soma ICMS itens | TOT‑006 |
| TOT‑04 | IPI não bate | vIPI declarado ≠ soma IPI itens | TOT‑002 |
| TOT‑05 | Desconto negativo | vDesc = −10 | TOT‑003 |
| TOT‑06 | Total nota não bate fórmula | vNF ≠ vProd − vDesc + vFrete + vSeg + vOutro + vIPI | TOT‑010 |
| TOT‑07 | Todos os totais zerados | Nota sem valor | ALERT: nota com valor zero |

## TC‑7: CFOP Engine

**Arquivo alvo:** `src/services/fiscal-ai/engines/cfop-engine.js`

| ID | Cenário | Entrada | CFOP esperado |
|----|---------|---------|---------------|
| CFOP‑01 | Venda interna produção própria | UF emit = UF dest, tipo = venda, prod = produção | 5101 |
| CFOP‑02 | Venda interna revenda | UF emit = UF dest, tipo = venda, prod = revenda | 5102 |
| CFOP‑03 | Venda interestadual produção | UF emit ≠ UF dest, tipo = venda, prod = produção | 6101 |
| CFOP‑04 | Venda interestadual revenda | UF emit ≠ UF dest, tipo = venda, prod = revenda | 6102 |
| CFOP‑05 | Devolução interna | UF emit = UF dest, operação = devolucao | 5202 |
| CFOP‑06 | Devolução interestadual | UF emit ≠ UF dest, operação = devolucao | 6202 |
| CFOP‑07 | Exportação | destino = exterior | 7101 |

## TC‑8: CST / CSOSN Engine

**Arquivo alvo:** `src/services/fiscal-ai/engines/cst-csosn-engine.js`

| ID | Cenário | CRT | Tributação ICMS | Esperado |
|----|---------|-----|-----------------|----------|
| TAX‑01 | Simples Nacional — tributado | 1 | alíquota > 0 | CSOSN 101 |
| TAX‑02 | Simples Nacional — isento | 1 | alíquota = 0 | CSOSN 103 |
| TAX‑03 | Regime Normal — tributado | 3 | alíquota > 0 | CST 00 |
| TAX‑04 | Regime Normal — isento | 3 | alíquota = 0 | CST 40 |
| TAX‑05 | CRT inválido | 99 | qualquer | Erro: CRT inválido |

## TC‑9: Regras Fiscais — NFe Rules Validation

**Arquivo alvo:** `src/services/fiscal-ai/engines/nfe-rules-validation-engine.js`

| ID | Cenário | Entrada | Issue esperada |
|----|---------|---------|----------------|
| NFE‑01 | Simples com ICMS > 0 | CRT = 1, vICMS > 0 | NFE_SIMPLES_ICMS_POSITIVO |
| NFE‑02 | Simples usando CST | CRT = 1, CST = '00' | NFE_SIMPLES_CST_INSTEAD_CSOSN |
| NFE‑03 | Normal usando CSOSN | CRT = 3, CSOSN = '101' | NFE_NORMAL_CSOSN_INSTEAD_CST |
| NFE‑04 | ST sem CEST | vICMSST > 0, CEST vazio | NFE_ST_SEM_CEST_MVA |
| NFE‑05 | IPI sem NCM na TIPI | vIPI > 0, NCM não industrializado | NFE_IPI_SEM_TIPI |

## TC‑10: API — NFe Validation endpoint

**Arquivo alvo:** `src/modules/nfe-validation/nfe-validation.routes.js`

| ID | Cenário | Método | Esperado |
|----|---------|--------|----------|
| API‑01 | Enviar NF‑e para validação | POST / | 200, runId, score, issues[] |
| API‑02 | Listar validações | GET / | 200, array de runs |
| API‑03 | Obter validação específica | GET /:runId | 200, run completo |
| API‑04 | Auto‑corrigir | POST /:runId/auto-correct | 200, diff de alterações |
| API‑05 | Enviar payload inválido | POST / { } | 400, erro de validação |

## TC‑11: Frontend — Página Emitir Nota

**Arquivo alvo:** `apps/web/app/(app)/emitir-nota/page.tsx`

| ID | Cenário | Esperado |
|----|---------|----------|
| UI‑E1 | Renderiza wizard com 5 steps | Steps Dados, Produtos, Impostos, Revisão, Emissão visíveis |
| UI‑E2 | Seleciona empresa cadastrada | CNPJ/IE/UF carregados do backend |
| UI‑E3 | Adiciona produto com NCM | Busca CFOP automaticamente |
| UI‑E4 | Calcula impostos | ICMS, PIS, COFINS exibidos conforme regime |
| UI‑E5 | Totais batem | Revisão mostra consistência |
| UI‑E6 | Emissão com erro de validação | Erro exibido, não transmite |

## TC‑12: Frontend — Página Validação NF‑e

**Arquivo alvo:** `apps/web/app/(app)/nfe-validation/page.tsx`

| ID | Cenário | Esperado |
|----|---------|----------|
| UI‑V1 | Lista validações existentes | Tabela com score, data, status |
| UI‑V2 | Abre detalhes de uma validação | Issues por fase, código da regra, severidade |
| UI‑V3 | Clica "Auto‑corrigir" | Chamada POST, diff retornado, nova validação criada |
| UI‑V4 | Score < 50 mostra alerta | "Alta probabilidade de rejeição" visível |