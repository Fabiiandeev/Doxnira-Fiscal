# Protocolo de Correção de Bugs — NF‑e

Protocolo obrigatório executado pelo agente `fiscal-nfe-validator` quando um bug é identificado em qualquer funcionalidade de NF‑e.

## Fluxo de correção

```
BUG ENCONTRADO
   ↓
[1] REPRODUZIR
   ↓
[2] IDENTIFICAR (arquivo + função)
   ↓
[3] DIAGNOSTICAR (causa raiz)
   ↓
[4] CORRIGIR (alteração mínima)
   ↓
[5] TESTAR (criar/ajustar teste)
   ↓
[6] VALIDAR (lint + typecheck + build)
   ↓
[7] REGISTRAR (pendências reais)
   ↓
PRONTO
```

## 1. Reproduzir

- Registrar a entrada exata que causou o erro (JSON, XML, payload da API).
- Confirmar que o bug é reproduzível com a mesma entrada.
- Se o erro depende de estado externo (ex.: SEFAZ offline), documentar a condição.

## 2. Identificar arquivo e função

- Apontar o arquivo exato e a linha/função onde o bug ocorre.
- Exemplo: `apps/api-js/src/services/nfe-validation/nfe-validation-engine.js:validateEmitente() linha 142`.

## 3. Diagnosticar causa raiz

- Explicar **em português claro** por que o bug acontece.
- Formato:

```
BUG: [código da regra se aplicável] — [descrição curta]

CAUSA RAIZ:
[Explicação técnica do erro]

IMPACTO:
[O que quebra na NF‑e se não corrigido — rejeição SEFAZ, cálculo errado, etc.]

EXEMPLO:
Entrada: [dados que causam o erro]
Resultado atual: [valor/status incorreto]
Resultado esperado: [valor/status correto conforme NT/MOC]
```

## 4. Corrigir com alteração mínima

- A correção deve ser a menor possível — preferir 1 linha a 10.
- Não refatorar código não relacionado ao bug.
- Não alterar assinaturas de função públicas sem necessidade.
- Se a correção envolver valor fiscal (alíquota, CFOP, NCM), validar contra tabela oficial antes de aplicar.
- **Nunca inventar dado fiscal.**

## 5. Criar ou ajustar teste

- Adicionar caso de teste que cubra o bug específico.
- Seguir os cenários em `docs/qa/fiscal-nfe-test-scenarios.md` quando aplicável.
- Teste deve falhar antes da correção e passar depois.
- Testes de unidade para lógica de backend (Jest/Vitest).
- Testes E2E para fluxos de frontend (Playwright).

## 6. Validar

Rodar **obrigatoriamente**:

```
npm run lint
npm run typecheck
npm run build
```

- Se lint falhar: corrigir warnings/errors ANTES de prosseguir.
- Se typecheck falhar: corrigir tipos ANTES de prosseguir.
- Se build falhar: identificar causa, corrigir, rodar novamente.
- Nenhum dos 3 comandos pode falhar após a correção.

## 7. Registrar pendências reais

Se algum problema não puder ser resolvido (ex.: depende de homologação SEFAZ real, certificado A1 não disponível no ambiente dev, tabela TIPI desatualizada):

- Registrar como pendência no arquivo `docs/qa/fiscal-nfe-pendencias.md` (criar se não existir).
- Formato:

```markdown
### [BUG-001] [Título curto]
- **Arquivo**: [caminho]
- **Causa**: [explicação]
- **Bloqueio**: [por que não pode ser corrigido agora]
- **Requisito para correção**: [o que precisa estar disponível]
- **Workaround**: [se houver]
- **Data**: YYYY-MM-DD
```

## Regras de segurança durante correção

- Certificado A1 nunca é versionado — se o bug envolver certificado, trabalhar apenas com mock em dev.
- Senha do certificado nunca aparece em logs ou código.
- Token SEFAZ nunca é logado.
- CNPJ/CPF em mensagens de erro devem ser mascarados.
- XML real de produção nunca é usado em testes — usar XML sintético/mock.

## Exemplo de bug corrigido

```
BUG: TOT-006 — total da nota não bate fórmula para notas com frete

CAUSA RAIZ:
A função `validateTotais()` em nfe-validation-engine.js calcula
vNF = vProd + vFrete + vSeg + vOutro + vIPI, mas não subtrai vDesc.
O MOC define: vNF = vProd − vDesc + vFrete + vSeg + vOutro + vIPI.

IMPACTO:
Notas fiscais com desconto serão rejeitadas pela SEFAZ com erro 610
(Total da NF não confere).

CORREÇÃO:
Linha 312, alterar:
  const expected = produtos + frete + seguro + outras + ipi;
para:
  const expected = produtos − desconto + frete + seguro + outras + ipi;

TESTE:
Criado TOT-06 em fiscal-nfe-test-scenarios.md — valida nota com desconto.

VALIDADO:
✓ npm run lint
✓ npm run typecheck
✓ npm run build
```