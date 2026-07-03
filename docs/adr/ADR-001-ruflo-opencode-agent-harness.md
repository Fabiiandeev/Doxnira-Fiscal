# ADR 001 – Ruflo + OpenCode Agent Harness

**Status:** Accepted
**Decisão:** Integrar Ruflo como camada de harness de agentes de desenvolvimento, QA, documentação e segurança, isolada do runtime da aplicação.

## Contexto
- Doxnira Fiscal é um ERP brasileiro com funcionalidades críticas de NF‑e, cálculo de impostos e integração fiscal.
- A equipe deseja melhorar a produtividade e a qualidade do código usando agentes de IA sem expor segredos nem degradar a experiência do usuário.
- Ruflo fornece um framework completo de agentes, memória vetorial e segurança de sandbox, mas inclui componentes de runtime que não devem entrar na entrega da aplicação.

## Opções consideradas
1. **Adicionar Ruflo como dependência runtime** – permitir que agentes sejam usados em produção.
   - *Desvantagem*: aumenta o bundle, risco de vazamento de credenciais, necessidade de manutenção em produção.
2. **Usar apenas plugins de Claude Code (lite)** – sem harness completo.
   - *Desvantagem*: perde recursos de memória compartilhada, swarm e segurança avançada.
3. **Executar Ruflo exclusivamente via `npx ruflo@latest`** – sem adicionar ao `package.json`, sem contaminar o lockfile. O harness roda apenas sob demanda, durante desenvolvimento e CI.
   - *Vantagem*: aproveita o ecossistema Ruflo, mantém runtime e dependências do projeto limpos, evita versionamento travado.

## Decisão tomada
Optamos pela **opção 3**: Ruflo será executado exclusivamente via `npx ruflo@latest init wizard`. Nenhuma dependência será adicionada ao `package.json`. O OpenCode atua como executor principal, orientado pelos arquivos `AGENTS.md` e pela documentação em `docs/`. Não há integração automática entre Ruflo e OpenCode — a comunicação é indireta e baseada nos arquivos de configuração e checklists.

## Consequências
- **Benefícios**: aumento de produtividade, geração automática de testes, auditoria de segurança, documentação viva via ADRs.
- **Riscos mitigados**: nenhum agente ou artefato do Ruflo será incluído no bundle de produção; políticas de sandbox e filtragem de segredos evitam vazamentos.
- **Operacional**: os desenvolvedores executam `npx ruflo@latest init wizard` uma única vez para configurar o harness local. As tarefas são delegadas ao OpenCode, que lê a documentação e executa os fluxos definidos nos checklists.

## Requisitos de implementação
- Criar a pasta `.ruflo/` com README (já feito).
- Definir lista de agentes em `docs/agents/AGENTS.md`.
- Documentar fluxo de uso em `docs/agents/ruflo-opencode-integration.md`.
- Garantir que `.gitignore` exclua `.ruflo/memory/` e arquivos temporários gerados pelo harness.

## Aprovação
- Arquitetura: João Silva (Lead Tech)
- Segurança: Maria Costa (Security Lead)
- Produto: Carlos Lima (Product Owner)
