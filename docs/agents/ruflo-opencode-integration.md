# Ruflo + OpenCode Integration Guide

Este documento descreve como usar **Ruflo** como camada de harness de agentes dentro do projeto **Doxnira Fiscal**. O objetivo é oferecer suporte automatizado para desenvolvimento, testes, documentação e auditoria sem impactar a aplicação em produção.

Ruflo foi configurado como camada de desenvolvimento, validação e QA, sem impacto runtime no ERP.

## Uso recomendado
- Não adicionar Ruflo como dependência (runtime ou dev).
- Preferir execução via `npx`:
  ```bash
  npx ruflo@latest init wizard
  ```
- Usar OpenCode como executor principal.
- Usar Ruflo como referência/harness de agentes, memória, validação e documentação.
- Validar cada função criada ou alterada com os checklists em `docs/`.
- Não assumir integração automática entre Ruflo e OpenCode sem validação manual.

## Como usar com OpenCode

O OpenCode deve ser orientado pelos arquivos `docs/agents/AGENTS.md` e este documento (`docs/agents/ruflo-opencode-integration.md`). Não há detecção automática do servidor MCP do Ruflo pelo OpenCode — a integração é indireta e baseada em documentação.

Para utilizar um agente descrito em `AGENTS.md`, instrua o OpenCode com o nome e as opções do agente. O OpenCode lerá o catálogo de agentes, o checklist de validação e as regras de segurança para executar o fluxo corretamente.

Exemplo de instrução para o OpenCode:

```
OpenCode, execute o agente fiscal-nfe-validator no arquivo ./samples/nfe.xml
e reporte erros conforme docs/agents/AGENTS.md.
```

## Fluxo de desenvolvimento típico
1. Escreva/alterar código.
2. Instrua o OpenCode a executar um agente (ex.: validação de NF‑e).
3. O OpenCode lê `AGENTS.md`, aplica as regras de segurança (`docs/security-rules.md`) e executa a tarefa.
4. Revise o resultado e aplique alterações se aprovado.
5. Execute o checklist de validação (`docs/validation-checklist.md`) antes de commitar.
6. Commit normalmente – nenhum artefato do Ruflo será incluído.

## Limites de segurança
- **Sem runtime**: Ruflo nunca é adicionado ao `package.json`.
- **Isolamento de memória**: dados permanecem em `.ruflo/memory/` (gitignored).
- **Proteção de segredos**: variáveis de ambiente e certificados A1 são filtrados.
- **Logs sanitizados**: CNPJ/CPF e XML sensíveis são mascarados conforme `docs/security-rules.md`.
- **Sandbox**: cada agente roda em processo Node.js isolado.

## O que pode e não pode modificar
- **Pode**: gerar/alterar código, migrations Prisma, testes, documentação ADR.
- **Não pode**: tocar arquivos de layout global ou configuração de produção.

## Verificando o estado
```bash
npx ruflo@latest status
```
Retorna a lista de agentes carregados, memória ativa e estado do harness.

---

**Próximos passos** – Consulte `docs/agents/AGENTS.md` para detalhes de cada agente e `docs/adr/ADR-001-ruflo-opencode-agent-harness.md` para a decisão arquitetural.
