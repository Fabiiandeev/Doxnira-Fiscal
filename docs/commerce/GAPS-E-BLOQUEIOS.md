# Gaps e Bloqueios - Doxnira Commerce

Este documento cataloga as lacunas funcionais, arquiteturais e de dados que impedem a implementação plena das funcionalidades do E-commerce hoje. **NÃO** se trata de um plano de correção, mas sim de um registro obrigatório para o backlog.

## 🔴 Gaps Críticos (Onde não há solução)
*   **Backend Marketplaces:** Ausência de *endpoints* e lógica de negócio dedicados para interações diretas com os sistemas dos marketplaces (Mercado Livre, Shopee, Amazon).
    *   *Ação Necessária:* Definir o contrato API completo antes do desenvolvimento.
*   **Contas Persistidas:** Não existe um domínio ou tabela dedicada para contas de marketplace persistidas e gerenciadas pelo sistema central.
*   **Webhooks Commerce:** Ausência de fluxo robusto de recebimento, processamento e roteamento de webhooks específicos do módulo E-commerce (ex: atualização de status de pedido).
*   **Precificação Completa:** A lógica atual de precificação é incompleta; faltam a integração completa de impostos complexos, tarifas variáveis por canal e custos operacionais.

## 🛑 Bloqueios Técnicos e Conceituais
1.  **Reserva de Estoque (Transacionalidade):** Atualmente, o mecanismo utiliza armazenamento em JSON no banco de dados (`schema.prisma` precisa ser revisado para transações). Isso é um bloqueio para operações críticas de inventário.
2.  **Configuração Marketplace:** A persistência da configuração por canal/marketplace também está acoplada a campos JSON, limitando consultas e validadores fortes.
3.  **Diferenciação de Dados:** É mandatório diferenciar claramente no sistema: dado Oficial (ERP), Público (Web), Estimado (Cálculo) e Informado (Usuário).

## 💡 Recomendações Futuras para Mitigação
*   Criar um serviço dedicado (`MarketplaceAdapterService`) que abstraia as diferenças de comunicação entre os canais.
*   Modelar transações financeiras em entidades separadas para garantir o *ACID compliance*.