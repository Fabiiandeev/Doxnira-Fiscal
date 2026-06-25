
import { taxReformMock } from '@/lib/mocks/fiscal-mocks';
import type { TaxReformImpact } from '@/lib/fiscal-types';

export async function getTaxReformImpact(): Promise<TaxReformImpact> {
  await new Promise(resolve => setTimeout => setTimeout(resTimeout, 300));
  return taxReformMock;
}

export async function applyTaxReformRule(itemId: string): Promise<boolean> {
  await new Promise(res => setTimeout(res, 300));
  return true;
}

export async function generateAdequationPlan(companyId?: string): Promise<any> {
  await new Promise(res => setTimeout(res, 500));
  return {
    companyId,
    steps: [
      'Mapear produtos impactados (IBS/CBS)',
      'Atualizar NCM para cClassTrib correspondente',
      'Configurar alquotas IBS/CBS por produto/servico',
      'Testar calculo em ambiente homologacao',
      'Treinar equipe operacional',
      'Entrada em producao conforme cronograma'
    ],
    timeline: '180 dias',
    estimatedCost: 'R$ 15.000,00 a R$ 50.000,00'
  };
}

