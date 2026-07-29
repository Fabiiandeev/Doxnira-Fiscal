# Certificação da Baseline - Sprint 00 Doxnira Commerce

Este documento serve como um checklist de verificação para a conclusão da documentação e validação do estado inicial do módulo E-commerce, garantindo que não haja alterações acidentais no código base durante o processo.

## ✅ Verificações Obrigatórias
1.  **Status Git:** O *working tree* deve estar limpa (`git status --short` = sem alterações).
2.  **Branching:** A branch de trabalho deve ser `feature/commerce-s00-baseline-governance`.
3.  **SHA Target:** O SHA da base deve corresponder a `774b91b015dc1e1b18ae9785ef33e538b316f417`.

## 🧪 Validação de Build e Testes (Simulado)
*   `pnpm api:prisma:validate`: Deve passar sem erros.
*   `pnpm api:prisma:generate`: Deve rodar, mas os *outputs* não devem alterar o `schema.prisma`.
*   Testes unitários (`test:unit`, `typecheck`): Devem ser executados contra a base e apenas falhar/alertar sobre a falta de cobertura para o novo escopo Commerce (mas sem *fail* no build).

## 🖼️ Verificação de Diferenças (Diff Check)
O resultado autorizado do *diff* deve conter **exclusivamente** alterações dentro do diretório `docs/commerce/**`. Qualquer outra alteração em:
*   `apps/api-js/prisma/schema.prisma`
*   `apps/api-js/src`
*   `apps/web`
*   `package.json` ou lockfiles
... indica uma violação das regras da Sprint 00 e deve ser revertida.

## 📝 Commit Sugerido
```bash
docs(commerce): establish Sprint 00 baseline and reuse map
```