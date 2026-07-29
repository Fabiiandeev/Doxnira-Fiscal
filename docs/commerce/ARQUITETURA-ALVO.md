# Arquitetura Alvo - Doxnira Commerce

Este documento descreve a arquitetura ideal para o módulo E-commerce, baseada nas necessidades de escalabilidade, desacoplamento e governança identificadas na Sprint 00.

## 🏗️ Visão Geral
A arquitetura deve seguir um padrão *Domain-Driven Design* (DDD), tratando cada canal (Mercado Livre, Shopee, etc.) como um domínio semi-autônomo, orquestrado por serviços centrais de negócio (Core Services).

### Camadas Arquiteturais Propostas
1.  **Presentation Layer (Web/App):** Responsável pela UI e consumo dos serviços através de APIs padronizadas (`apps/web`). Deve ser *agnóstica* ao canal.
2.  **Application Service Layer:** Orquestra o fluxo de negócio, chamando os serviços de domínio em sequência (Ex: `ProductService` -> `PricingService` -> `StockService`).
3.  **Domain Service Layer:** Contém a lógica de negócio pura e imutável (Ex: Cálculo de Margem, Regras de Preço). Deve ser independente do banco de dados.
4.  **Infrastructure/Persistence Layer:** Abstrai o acesso ao banco de dados e serviços externos (Marketplace APIs, Webhooks).

## 🔗 Fluxos Críticos Reestruturados
*   **Fluxo Pedido:** `Web Hook Recebido` $\to$ `Application Service` $\to$ `Order Domain Service` $\to$ `StockService` (deduz estoque) $\to$ `Payment/Invoice Service`.
*   **Sincronização de Produtos:** Deve ser um processo assíncrono, orquestrado por Jobs (`BullMQ`), que recebe dados brutos e os mapeia para o modelo canônico do sistema.

## 🛡️ Princípio de Desacoplamento
A comunicação entre módulos deve ocorrer preferencialmente via eventos (Event Sourcing) ou contratos API bem definidos, minimizando chamadas diretas de função (`direct function calls`) entre serviços distintos.