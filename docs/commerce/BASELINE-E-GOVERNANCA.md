# Baseline e Governança - Sprint 00 Doxnira Commerce

Este documento detalha os princípios de governança adotados para o desenvolvimento do E-commerce, garantindo a rastreabilidade, segurança e conformidade com padrões internos.

## 📜 Status da Baseline
*   **Status:** Aprovada (Condicional)
*   **Data Base:** Sprint 00
*   **Revisão:** [Preencher após revisão]

### Princípios de Governança Aplicados
1.  **Segurança e Autorização:** Uso obrigatório do `company-access` middleware em todas as rotas que manipulam dados sensíveis (Empresa, Cliente).
2.  **Multiempresa:** O sistema deve ser projetado desde o início para suportar múltiplas empresas (`Company`), garantindo isolamento de dados a nível de banco e aplicação.
3.  **Rastreabilidade:** Todo fluxo crítico deve registrar em `AuditLog`, capturando quem, quando e qual ação foi realizada.

### Pontos de Atenção (Governança)
*   A camada de persistência deve ser o ponto único de verdade para todas as entidades transacionais.
*   Revisar a implementação do *scope* de dados por empresa em todos os serviços (`services/` em `apps/web/lib`).

## 🚧 Riscos e Bloqueios Governança
*   **Bloqueio:** Falta de um contrato API formalizado para interações entre módulos (necessidade de definição clara de payloads).
*   **Risco:** Dependência excessiva de JSON na reserva de estoque e configuração de marketplace, exigindo modelagem relacional futura.

## ✅ Critério de Aceite da Baseline
Todas as funcionalidades desenvolvidas nas próximas sprints devem passar por uma revisão que valide o cumprimento destes princípios de governança antes do merge em `master`.