export const fiscalAutopilotMock = {
  summary: {
    totalIssues: 42,
    autoSafeCount: 21,
    needsConfirmationCount: 13,
    needsAccountantCount: 8,
    financialImpact: 72450.00,
    fiscalScore: 82,
    correctionsApplied: 156
  },
  categories: [
    {
      label: "Correcao automatica segura",
      count: 21,
      type: "AUTO_SAFE",
      items: [
        {
          id: "1",
          code: "IBGE_MISSING",
          title: "Codigos IBGE ausentes",
          description: "9 municipios sem codigo IBGE no cadastro de clientes",
          type: "AUTO_SAFE",
          riskLevel: "LOW",
          status: "OPEN",
          responsible: "SYSTEM",
          financialImpact: 0,
          confidence: 0.98,
          ruleReference: "MOC_NFE v3.10 - Regra 12.3",
          autoFixAction: "Preencher IBGE via API de municipios",
          relatedEntityIds: ["client-1", "client-2", "client-3"]
        },
        {
          id: "2",
          code: "XML_DUPLICATE",
          title: "XMLs duplicados",
          description: "4 documentos com mesma chave de acesso importados",
          type: "AUTO_SAFE",
          riskLevel: "LOW",
          status: "OPEN",
          responsible: "SYSTEM",
          financialImpact: 0,
          confidence: 1.0,
          ruleReference: "MOC_NFE v3.10 - Regra 8.1",
          autoFixAction: "Remover duplicatas mantendo o XML completo",
          relatedEntityIds: ["doc-1", "doc-2"]
        },
        {
          id: "3",
          code: "TOTAL_DIVERGENT",
          title: "Totais divergentes",
          description: "6 notas com valor total diferente da soma dos itens",
          type: "AUTO_SAFE",
          riskLevel: "MEDIUM",
          status: "OPEN",
          responsible: "SYSTEM",
          financialImpact: 12450.00,
          confidence: 0.95,
          ruleReference: "MOC_NFE v3.10 - Regra 15.2",
          autoFixAction: "Recalcular total pela soma dos itens",
          relatedEntityIds: ["doc-3", "doc-4", "doc-5"]
        }
      ]
    },
    {
      label: "Correcao automatica nao segura",
      count: 13,
      type: "AUTO_NOT_SAFE",
      items: [
        {
          id: "1",
          code: "IE_INDICATOR_MISSING",
          title: "Clientes sem indicador IE",
          description: "3 clientes sem indicador de inscricao estadual",
          type: "AUTO_NOT_SAFE",
          riskLevel: "LOW",
          status: "OPEN",
          responsible: "SYSTEM",
          financialImpact: 0,
          confidence: 0.92,
          ruleReference: "MOC_NFE v3.10 - Regra 11.4",
          autoFixAction: "Definir indicador IE = 9 (nao contri...)",
          relatedEntityIds: []
        }
      ]
    }
  ]
};