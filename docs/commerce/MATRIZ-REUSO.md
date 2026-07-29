# Matriz de Reuso - Doxnira Commerce

Este documento visa mapear quais componentes, serviços e conceitos do código base existente são reutilizáveis para acelerar o desenvolvimento dos módulos E-commerce.

## 🔁 Mapeamento de Reutilização
| Origem (Módulo/Componente) | Destino (Novo Módulo) | Funcionalidade Reutilizada | Nível de Reuso | Notas |
| :--- | :--- | :--- | :--- | :--- |
| `company-access.middleware.js` | Todos os módulos | Controle de Acesso por Empresa | Alto | Governança essencial. Deve ser mantido como o *gate* principal. |
| `product-service.ts` | Produtos Marketplace, Anúncios | Lógica CRUD básica do Produto | Alto | Pode ser estendido para adicionar regras específicas de canal (ex: Amazon). |
| `AuditLog` | Todos os módulos | Registro de Eventos Transacionais | Alto | Garante a rastreabilidade em qualquer novo fluxo. |
| Estrutura NFe | Pedidos, Preços | Modelagem e Fluxo Fiscal Básico | Médio | O conceito fiscal já existe; foco será na adaptação para o contexto Commerce. |
| `CompanyProvider` | Dashboard Commerce | Contexto de Usuário/Empresa Ativa | Alto | Fundamental para a experiência multiempresa. |

## ♻️ Diretrizes para Reuso
1.  **Priorizar:** Utilizar sempre que possível os serviços e middlewares existentes em vez de reescrever lógica (ex: usar `company-access` vs. criar um novo middleware).
2.  **Modularização:** Ao reutilizar, encapsular a lógica em *wrappers* ou adaptadores para desacoplar o módulo consumidor do módulo original.
3.  **Limitações:** O reuso de componentes deve ser acompanhado da documentação clara das suas limitações (Ex: `product-service` atual não considera regras de precificação por marketplace).