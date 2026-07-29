const definitions = [
  ["MERCADO_LIVRE","marketplaces"],["SHOPEE","marketplaces"],["NFSE","fiscal"],["NFCE","fiscal"],["MDFE","fiscal"],["SICOOB","financial"],["FISCAL_AI","fiscal-ai"],["EMAIL","notifications"],["STORAGE","documents"],["WEBHOOKS","integrations"],
];
export async function listIntegrationSettings(repository, companyId) {
  const [marketplaces, banks] = await Promise.all([repository.marketplaces(companyId), repository.banks(companyId)]);
  return definitions.map(([provider,module]) => {
    const connection = marketplaces.find((item) => item.provider === provider) || banks.find((item) => item.provider === provider);
    const marketplaceError = connection?.metadata && typeof connection.metadata === "object" ? connection.metadata.lastError : null;
    const lastError = connection?.lastError || marketplaceError || null;
    const status = connection?.status === "CONNECTED" || connection?.status === "ACTIVE" || connection?.status === "active" ? "CONNECTED" : connection ? (lastError ? "DEGRADED" : "CONFIGURED") : "CONFIGURATION_REQUIRED";
    return { provider, module, status, configured: Boolean(connection), connectedAt: connection?.connectedAt || null, lastCheckAt: connection?.updatedAt || null, lastSyncAt: connection?.lastSyncAt || null, lastError, environment: connection?.environment || null, actions: status === "CONFIGURATION_REQUIRED" ? ["configure","documentation"] : ["test","deactivate","errors","documentation"] };
  });
}
