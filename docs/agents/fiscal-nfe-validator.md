# fiscal-nfe-validator

Agente de validação obrigatória para qualquer funcionalidade relacionada à NF‑e (Nota Fiscal Eletrônica, modelo 55) no projeto Doxnira Fiscal.

**Executor:** OpenCode, orientado por esta documentação.
**Harness:** Ruflo (camada auxiliar dev‑only, `npx ruflo@latest init wizard`).

## Escopo de validação

O agente cobre 7 domínios fiscais e estruturalmente mapeia os módulos existentes no projeto.

| # | Domínio | Módulos existentes |
|---|---------|-------------------|
| 1 | Cadastro da empresa | `src/services/company-fiscal-config.service.js`, `src/services/fiscal-config-validator.service.js` |
| 2 | Cliente / destinatário | `src/services/fiscal-xml-parser.service.js` (parsing), validação no `nfe-validation-engine.js` fase Destinatario |
| 3 | Produto | `src/modules/products/ncm-analysis.service.js`, `src/modules/products/fiscal-simulation.service.js`, `src/services/fiscal-ai/engines/cfop-engine.js` |
| 4 | Impostos | `src/services/tax-calculation.service.js`, `src/services/tax-rules.service.js`, `src/services/fiscal-ai/engines/cst-csosn-engine.js`, `src/services/fiscal-ai/engines/incidence-engine.js` |
| 5 | Totais da NF‑e | `src/services/nfe-validation/nfe-validation-engine.js` (fase Totais, 10 regras TOT‑*) |
| 6 | XML | `src/services/fiscal-xml-parser.service.js`, `src/services/xml-signature.service.js`, `src/services/xml.service.js`, `src/utils/nfe-access-key.js` |
| 7 | Correção automática | `src/services/nfe-validation/nfe-validation-engine.js` (`applyAutoCorrections`) |

## Como usar

Instrua o OpenCode com:

```
OpenCode, execute o agente fiscal-nfe-validator no escopo [ESCOPO].
Verifique conforme docs/agents/fiscal-nfe-validator.md,
docs/qa/fiscal-nfe-validation-checklist.md e docs/security-rules.md.
```

Substitua `[ESCOPO]` por um ou mais domínios (1–7), um arquivo específico, ou "completo" para todos.

## Regras do agente

### O que o agente SEMPRE faz
- Lê os arquivos de código reais listados acima.
- Verifica conformidade com a documentação oficial NF‑e (NTs, Manual de Orientação do Contribuinte).
- Reporta erros em português claro com código da regra (ex.: `EMIT‑001`, `PROD‑004`, `XML‑003`).
- Sugere correção com alteração mínima no arquivo afetado.
- Após qualquer alteração, executa:
  ```
  npm run lint
  npm run typecheck
  npm run build
  ```

### O que o agente NUNCA faz
- Inventar dados fiscais (NCM, CFOP, CST, alíquota) — tudo deve vir de tabela oficial ou `cfops` seed.
- Alterar package.json, lockfiles ou configuração de produção.
- Tocar arquivos de layout global (`app-shell.tsx`, `globals.css`, `layout.tsx`).
- Modificar componentes de UI mock sem antes verificar se existe API real correspondente.
- Aplicar correção automática sem confirmação explícita do desenvolvedor.

### Dependências proibidas
- Não adicionar novas dependências ao projeto.
- Não depender de serviços externos não configurados (ex.: SEFAZ real em homologação requer `SEFAZ_INTEGRATION_ENABLED`).

## Pontos de atenção por domínio

### 1. Cadastro da empresa
- **CNPJ**: 14 dígitos, dígitos verificadores válidos.
- **IE**: formato por UF (consulta Sintegra), 9–14 dígitos.
- **CRT**: 1 (Simples Nacional), 2 (Simples com excesso), 3 (Regime Normal).
- **Regime tributário**: deve corresponder ao CRT declarado.
- **UF**: sigla IBGE válida (ex.: SP, MG, RJ).
- **Município IBGE**: 7 dígitos, existente para a UF.
- **Certificado A1**: validade > 30 dias, cadeia ICP‑Brasil.
- **Ambiente**: 1 (produção) ou 2 (homologação).

### 2. Cliente / destinatário
- **CNPJ/CPF**: 14 ou 11 dígitos, verificadores válidos.
- **IE**: obrigatório para contribuinte; isento se `indIEDest = 9`.
- **indicador IE**: 1 (contribuinte), 2 (isento), 9 (não contribuinte).
- **Endereço completo**: logradouro, número, bairro, CEP (8 dígitos).
- **UF**: deve ser UF de destino para cálculo de DIFAL.
- **Município IBGE**: 7 dígitos.

### 3. Produto
- **NCM**: 8 dígitos, tabela TIPI vigente.
- **CEST**: 7 dígitos quando item sujeito a ST; vazio caso contrário.
- **CFOP**: 4 dígitos; 5xxx (interno) ou 6xxx (interestadual) conforme UF emitente × destinatário.
- **Unidade comercial**: compatível com NCM (UN, KG, LT, M, M2, M3, CX, PCT).
- **Unidade tributável**: pode diferir da comercial; fator de conversão.
- **Origem**: 0 (nacional), 1 (importação direta), 2 (adquirida no mercado interno com conteúdo importado), 3–8.
- **GTIN/EAN**: validar dígito verificador quando presente (8, 12, 13 ou 14 dígitos).
- **Peso**: líquido e bruto > 0.

### 4. Impostos
- **ICMS**: base de cálculo, alíquota (interna 12–25%, interestadual 4–12%), valor.
- **CSOSN** (Simples Nacional): 101, 102, 103, 201, 202, 203, 300, 400, 500, 900.
- **CST** (Regime Normal): 00, 10, 20, 30, 40, 41, 50, 51, 60, 70, 90.
- **PIS/COFINS**: CST 01–99; alíquotas cumulativas (0,65% / 3%) ou não cumulativas (1,65% / 7,6%).
- **IPI**: obrigatório para produtos industrializados com NCM na TIPI.
- **FCP**: Fundo de Combate à Pobreza — apenas para UF que instituíram (alíquota adicional 0–2%).
- **DIFAL**: obrigatório quando UF emitente ≠ UF destinatário, destinatário contribuinte ou não contribuinte (EC 87/2015).
- **Regime**: CRT define se usa CSOSN (Simples) ou CST (Normal). Não misturar no mesmo item.

### 5. Totais
- Soma dos valores de produtos × quantidade deve bater com `totalProdutos`.
- `totalICMS`, `totalIPI`, `totalPIS`, `totalCOFINS` devem corresponder à soma por item.
- `totalDesconto`, `totalFrete`, `totalSeguro`, `totalOutrasDespesas` devem ser consistentes com os campos individuais.
- `totalNota = totalProdutos − totalDesconto + totalFrete + totalSeguro + totalOutrasDespesas + totalIPI` (ICMS/PIS/COFINS são informativos, não entram no total).

### 6. XML
- Schema: `nfe_v4.00.xsd` (NT 2024.001).
- Campos obrigatórios por layout: `ide`, `emit`, `dest`, `det`, `total`, `transp`, `cobr`, `infAdic`.
- Chave de acesso: 44 dígitos com dígito verificador (módulo 11).
- Assinatura digital: XML‑DSig, certificado A1, referência à `infNFe`.
- Ambiente: `tpAmb = 1` (produção) ou `2` (homologação).
- Versão: `verAplic` do sistema emissor declarado.

### 7. Correção automática
- Identificar erro pelo código da regra.
- Explicar em português: o que está errado, qual o valor esperado, qual a base normativa.
- Sugerir correção com alteração mínima no arquivo de código.
- Aplicar somente correções seguras (formatação, validação estrutural). Nunca corrigir automaticamente valores fiscais sem revisão humana.

## Protocolo de correção de bugs

Quando encontrar um bug no código de NF‑e:

1. Reproduzir o erro com dados de entrada reais.
2. Identificar arquivo e função exatos (ex.: `nfe-validation-engine.js:validateEmitente()`).
3. Explicar causa raiz em português.
4. Corrigir com a menor alteração possível.
5. Criar ou ajustar teste correspondente (ver `docs/qa/fiscal-nfe-test-scenarios.md`).
6. Rodar:
   ```
   npm run lint
   npm run typecheck
   npm run build
   ```
7. Registrar pendências reais se algo não puder ser resolvido.

Consulte `docs/qa/fiscal-nfe-bugfix-protocol.md` para o protocolo detalhado.

## Referências

- [Manual de Orientação do Contribuinte — NF‑e](http://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=Iy/9Hp7qwOI=)
- [Notas Técnicas NF‑e](http://www.nfe.fazenda.gov.br/portal/principal.aspx)
- [Tabela NCM/TIPI](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/legislacao/documentos-e-arquivos/tipi)
- [Tabela CFOP](https://www.confaz.fazenda.gov.br/legislacao/ajustes/2024/AJ_008_24)
- Prisma schema: `apps/api-js/prisma/schema.prisma` — modelos `NfeDocument`, `NfeItem`, `NfeTotal`, `NfeValidationResult`
- `apps/api-js/scripts/migrate-cfops.mjs` — seed de 400+ CFOPs
- `apps/web/lib/nfe-validation-types.ts` — tipos TypeScript da validação