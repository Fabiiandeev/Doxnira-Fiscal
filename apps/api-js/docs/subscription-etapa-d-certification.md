# ETAPA D — Certificação de assinaturas

Baseline: `ee9cd9e5a91a12114737c079ca1e5b9c2f575e07`.

O backend usa os serviços certificados da ETAPA C para lifecycle, períodos, preços, idempotência e usage. A API resolve empresa e ator pelo contexto autenticado. Todas as mutações HTTP exigem `Idempotency-Key` com até 160 caracteres.

A reconciliação aplica, nesta ordem: cancelamento vencido, trial vencido, mudança agendada e renovação MANUAL. As chaves internas são determinísticas.

O manifesto classifica as 47 features oficiais. `webhooks.access`, `erp.integration` e `accountant.productivity_dashboard` permanecem como módulos de produto não implementados; não existe funcionalidade fictícia para elas.

Gates integrados nesta entrega: `dfe.sync` e `exports.advanced`. O middleware central está disponível para as demais integrações incrementais sem duplicar regras de planos.

Não houve mudança em migrations, fiscal-pay, cálculo fiscal, XML ou transmissão SEFAZ.
