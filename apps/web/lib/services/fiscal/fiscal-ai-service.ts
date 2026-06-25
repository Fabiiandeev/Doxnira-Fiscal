import { fiscalAiMock } from '@/lib/mocks/fiscal-mocks';
import type { FiscalAiResponse } from '@/lib/fiscal-types';

export async function askFiscalAI(question: string): Promise<FiscalAiResponse> {
  await new Promise(resolve => setTimeout(resolve, 800));

  const normalizedQuestion = question.toLowerCase().trim();

  if (normalizedQuestion.includes('rejeit')) {
    return {
      answer: 'Analisei as notas rejeitadas. 3 tem rejeicao por CST invalido, 2 por CFOP errado e 1 por certificado vencido.',
      suggestions: [
        { id: 's1', entityType: 'document', entityId: 'doc-1', field: 'cst', currentValue: '90', suggestedValue: '00', confidence: 0.9, ruleReference: 'Conv. ICMS 109/24', ruleSource: 'MOC_NFE', financialImpact: 5200, type: 'AUTO_CONFIRM' },
        { id: 's2', entityType: 'document', entityId: 'doc-2', field: 'cfop', currentValue: '5.102', suggestedValue: '6.102', confidence: 0.95, ruleReference: 'Anexo IV MOC', ruleSource: 'MOC_NFE', financialImpact: 3100, type: 'AUTO_CONFIRM' },
        { id: 's3', entityType: 'document', entityId: 'doc-3', field: 'certificate', currentValue: 'expired', suggestedValue: 'renew', confidence: 1.0, ruleReference: 'ICP-Brasil', ruleSource: 'INTERNAL_RULE', financialImpact: 120000, type: 'ACCOUNTANT_REVIEW' },
      ],
      actions: [
        { label: 'Aplicar 2 correcoes automaticas', action: 'apply_all', count: 2, type: 'AUTO_CONFIRM' },
        { label: 'Enviar certificado para contador', action: 'send_to_accountant', count: 1, type: 'ACCOUNTANT_REVIEW' },
        { label: 'Ver detalhes das rejeicoes', action: 'view_details', count: 3, type: 'MANUAL_GUIDED' },
      ],
      confidence: 0.92,
      sources: ['MOC_NFE v3.10', 'Conv. ICMS 109/24', 'Regras ICP-Brasil'],
    };
  }

  if (normalizedQuestion.includes('fechamento') || normalizedQuestion.includes('prontas')) {
    return {
      answer: 'Das 10 empresas do portfolio, 7 estao prontas para fechamento. 3 tem pendencias: Gama Tech (certificado + SPED), Beta Servicos (NFS-e), Delta Autopecas (NCM).',
      suggestions: [
        { id: 's1', entityType: 'tax', entityId: 'comp-1', field: 'certificate', currentValue: 'expiring', suggestedValue: 'renew', confidence: 1.0, ruleReference: 'ICP-Brasil', ruleSource: 'INTERNAL_RULE', financialImpact: 31200, type: 'ACCOUNTANT_REVIEW' },
        { id: 's2', entityType: 'tax', entityId: 'comp-2', field: 'nfse_code', currentValue: null, suggestedValue: '01.01', confidence: 0.85, ruleReference: 'LC 116/2003', ruleSource: 'NFSE_NACIONAL', financialImpact: 18900, type: 'AUTO_CONFIRM' },
        { id: 's3', entityType: 'product', entityId: 'prod-batch-1', field: 'ncm', currentValue: null, suggestedValue: 'multiple', confidence: 0.88, ruleReference: 'TIPI 2024', ruleSource: 'MOC_NFE', financialImpact: 11400, type: 'AUTO_CONFIRM' },
      ],
      actions: [
        { label: 'Resolver pendencias criticas', action: 'apply_all', count: 3, type: 'ACCOUNTANT_REVIEW' },
        { label: 'Aplicar NCM em lote', action: 'apply_all', count: 12, type: 'AUTO_CONFIRM' },
        { label: 'Ver relatorio completo', action: 'view_details', count: 10, type: 'MANUAL_GUIDED' },
      ],
      confidence: 0.88,
      sources: ['Dashboard Fiscal', 'FiscalAI Analysis', 'SPED Status'],
    };
  }

  if (normalizedQuestion.includes('ncm') || normalizedQuestion.includes('produto')) {
    return {
      answer: 'Encontrei 12 produtos sem NCM. 8 tem sugestao com confianca alta (>85%). 4 precisam de revisao do contador por serem itens com ST.',
      suggestions: [
        { id: 's1', entityType: 'product', entityId: 'prod-1', field: 'ncm', currentValue: null, suggestedValue: '8517.12.00', confidence: 0.92, ruleReference: 'TIPI 2024 - Cap. 85', ruleSource: 'MOC_NFE', financialImpact: 2450, type: 'AUTO_CONFIRM' },
        { id: 's2', entityType: 'product', entityId: 'prod-2', field: 'ncm', currentValue: null, suggestedValue: '8517.12.00', confidence: 0.89, ruleReference: 'TIPI 2024 - Cap. 85', ruleSource: 'MOC_NFE', financialImpact: 1890, type: 'AUTO_CONFIRM' },
        { id: 's3', entityType: 'product', entityId: 'prod-3', field: 'ncm', currentValue: null, suggestedValue: '8471.30.12', confidence: 0.85, ruleReference: 'TIPI 2024 - Cap. 84', ruleSource: 'MOC_NFE', financialImpact: 3200, type: 'AUTO_CONFIRM' },
        { id: 's4', entityType: 'product', entityId: 'prod-4', field: 'ncm', currentValue: null, suggestedValue: '8471.30.12', confidence: 0.65, ruleReference: 'TIPI 2024 - Cap. 84', ruleSource: 'MOC_NFE', financialImpact: 1100, type: 'ACCOUNTANT_REVIEW' },
      ],
      actions: [
        { label: 'Aplicar 8 sugestoes seguras', action: 'apply_all', count: 8, type: 'AUTO_CONFIRM' },
        { label: 'Enviar 4 para contador (ST)', action: 'send_to_accountant', count: 4, type: 'ACCOUNTANT_REVIEW' },
        { label: 'Ver todos os 12 produtos', action: 'view_details', count: 12, type: 'MANUAL_GUIDED' },
      ],
      confidence: 0.85,
      sources: ['TIPI 2024', 'MOC_NFE v3.10', 'Regras internas'],
    };
  }

  if (normalizedQuestion.includes('sped') || normalizedQuestion.includes('bloquei')) {
    return {
      answer: 'SPED Fiscal de Junho/2026 bloqueado por 3 produtos sem NCM na empresa Gamma Autopecas. Impacto: multa de R$ 25.000,00 se nao entregue ate 31/07.',
      suggestions: [
        { id: 's1', entityType: 'product', entityId: 'prod-100', field: 'ncm', currentValue: null, suggestedValue: '8708.99.90', confidence: 0.91, ruleReference: 'TIPI 2024 - Cap. 87', ruleSource: 'MOC_NFE', financialImpact: 8900, type: 'AUTO_CONFIRM' },
        { id: 's2', entityType: 'product', entityId: 'prod-101', field: 'ncm', currentValue: null, suggestedValue: '4011.10.00', confidence: 0.87, ruleReference: 'TIPI 2024 - Cap. 40', ruleSource: 'MOC_NFE', financialImpact: 6200, type: 'AUTO_CONFIRM' },
        { id: 's3', entityType: 'product', entityId: 'prod-102', field: 'ncm', currentValue: null, suggestedValue: '8512.20.00', confidence: 0.72, ruleReference: 'TIPI 2024 - Cap. 85', ruleSource: 'MOC_NFE', financialImpact: 9900, type: 'ACCOUNTANT_REVIEW' },
      ],
      actions: [
        { label: 'Aplicar 2 NCM automaticos', action: 'apply_all', count: 2, type: 'AUTO_CONFIRM' },
        { label: 'Enviar 1 para contador', action: 'send_to_accountant', count: 1, type: 'ACCOUNTANT_REVIEW' },
        { label: 'Ver detalhes do SPED', action: 'view_details', count: 1, type: 'MANUAL_GUIDED' },
      ],
      confidence: 0.88,
      sources: ['SPED ICMS/IPI', 'MOC_NFE v3.10', 'TIPI 2024'],
    };
  }

  return {
    answer: 'A FiscalAI analisou sua pergunta. Para respostas mais precisas, tente uma das sugestoes rapidas ou seja mais especifico sobre qual modulo fiscal.',
    suggestions: [],
    actions: [
      { label: 'Ver sugestoes rapidas', action: 'view_details', count: 6, type: 'MANUAL_GUIDED' },
    ],
    confidence: 0.5,
    sources: ['FiscalAI Knowledge Base'],
  };
}

export async function getQuickQuestions(): Promise<string[]> {
  return fiscalAiMock.quickQuestions;
}

export async function applyAISuggestions(suggestionIds: string[]): Promise<{ success: number; failed: number }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { success: suggestionIds.length, failed: 0 };
}
