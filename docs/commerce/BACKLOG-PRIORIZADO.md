# Backlog Priorizado - Doxnira Commerce

Este documento propõe o roteiro de desenvolvimento do módulo E-commerce, dividindo as funcionalidades em sprints incrementais e definindo dependências claras para garantir um fluxo de trabalho coeso.

## 🗺️ Roteiro das Sprints
| Sprint | Tema Principal | Dependências Chave | Entidades Reutilizadas/Criadas | APIs Necessárias | Riscos Principais | Critério de Aceite (DoD) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Sprint 01** | Marketplace Core e Mercado Livre OAuth | `Company` Model, Produto Base. | Implementação do fluxo OAuth e API de listagem básica. | `/marketplaces/ml/auth`, `/products/{id}/details` | Complexidade da integração com APIs externas (OAuth). | Mapeamento bem-sucedido de 1 produto em teste no ML. |
| **Sprint 02** | Catálogo e Anúncios | Sprint 01, `Product` Model. | Domínio de Anúncio; API de criação/atualização de anúncios por canal. | `/listings`, `/products/{id}/update-listing` | Diferenças estruturais entre canais (ML vs Shopee). | Criação bem-sucedida e visível do anúncio em um ambiente de sandbox. |
| **Sprint 03** | Pedidos e Pipeline Fiscal | Sprint 02, `NfeDocument` Model. | Serviço de Orquestração de Pedido; Mapeamento de Status (do Canal $\to$ Interno). | `/orders/create`, `/orders/{id}/status-update` | Complexidade do fluxo fiscal transacional após o pedido. | Emissão e registro fiscal completo para um pedido simulado. |
| **Sprint 04** | Preços e Margens | Sprint 03, `Product` Model (Completo). | Serviço de Precificação Centralizado; Cálculo de Custos. | `/pricing/calculate`, `/products/{id}/cost-update` | Dependência de dados fiscais e taxas externas não mapeadas. | Precificação automática funcionando com margem calculada em tempo real. |
| **Sprint 05** | Dashboard Commerce | Sprint 04, Todos os módulos anteriores. | Agregação de KPIs; Widgets visuais. | `/dashboard/metrics` | Dependência da estabilidade e acuracidade dos dados das Sprints 01-04. | Painel carregando métricas consolidadas com base em dados reais do sistema. |
| **Sprint 06** | Concorrência e Oportunidades | Sprint 05, `Product` Model. | Serviço de Monitoramento de Preço/Concorrência. | `/competitor/monitor`, `/opportunities/create` | Fonte confiável de dados de concorrência (scraping legal). | Ingestão automática e classificação de um concorrente em uma planilha modelo. |
| **Sprint 07** | Shopee | Sprint 01, `Product` Model. | Adaptação do fluxo de integração para o padrão Shopee. | `/marketplaces/shopee/...` | Documentação específica da API da Shopee. | Conexão e sincronização funcional com o sandbox da Shopee. |
| **Sprint 08** | Amazon | Sprint 01, `Product` Model. | Adaptação do fluxo de integração para o padrão Amazon. | `/marketplaces/amazon/...` | Complexidade na gestão de SKUs e variações em grande escala. | Criação bem-sucedida de um *listing* complexo (variações). |

***Nota:** As próximas sprints não devem implementar funcionalidades, mas sim apenas a estrutura do contrato API e os testes unitários para as novas regras.*