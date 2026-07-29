# Inventário Técnico - Doxnira Commerce

Este documento mapeia todas as entidades de dados, componentes visuais e serviços identificados no repositório que são relevantes para o módulo E-commerce, classificando seu status atual de reutilização.

## 🧩 Entidades de Dados (Modelagem)
| Entidade | Módulos/Localização | Classificação | Observações |
| :--- | :--- | :--- | :--- |
| **Product** | `apps/api-js/prisma/schema.prisma` | REUTILIZÁVEL | Core Product Model. |
| **Client** | (Não mapeado explicitamente) | PARCIAL | Necessita de detalhamento do fluxo de cadastro e dados. |
| **Company** | `apps/api-js/prisma/schema.prisma` | REUTILIZÁVEL | Entidade central para multiempresa. |
| **User** | (Não mapeado explicitamente) | PARCIAL | Relacionamento com `Company`. |
| **NfeDocument, NfeItem, NfeTotal, NfeEntry** | Módulos NFe (`apps/api-js/src/modules/nfe/...`) | REUTILIZÁVEL | Fluxo fiscal estabelecido e reutilizável. |
| **StockMovement** | (Implícito em lógica de estoque) | PARCIAL | O conceito existe, mas a modelagem precisa ser revisada para transacionalidade. |
| **AuditLog** | `apps/api-js/src/modules/audit/...` | REUTILIZÁVEL | Mecanismo de rastreabilidade robusto. |

## 💻 Componentes Visuais e Serviços (Frontend)
*   **Services:** `apps/web/lib/services/product-service.ts`, `marketplace/service.ts`. **Classificação:** REUTILIZÁVEL.
*   **Views:** `apps/web/components/products/*View.tsx`. **Classificação:** PARCIAL (Precisa de adaptação para diferentes canais).
*   **Hooks/Providers:** `CompanyProvider`, `PermissionsProvider`. **Classificação:** REUTILIZÁVEL.

## ⚙️ Infraestrutura e Jobs
*   **Redis / BullMQ:** Utilizados para jobs assíncronos. **Classificação:** REUTILIZÁVEL.
*   **Middleware:** `company-access.middleware.js`. **Classificação:** REUTILIZÁVEL (Governança).

## ❓ Classificações Detalhadas
*   **REUTILIZÁVEL:** Componentes/entidades que estão prontos para serem consumidos por novos módulos com mínima alteração.
*   **PARCIAL:** Conceitos ou implementações existentes, mas que precisam de ajustes finos (ex: transição de JSON para modelo relacional).
*   **PLACEHOLDER:** Áreas no código destinadas a funcionalidades futuras, sem lógica comercial definida.
*   **NÃO LOCALIZADO:** Funcionalidade crítica mapeada pelo negócio, mas cuja implementação não foi identificada na inspeção do código base atual.
*   **BLOQUEADO:** Feature ou módulo que depende de uma decisão externa (ex: integração com um parceiro específico).
*   **PROPOSTA FUTURA:** Entidades/módulos planejados para sprints subsequentes.