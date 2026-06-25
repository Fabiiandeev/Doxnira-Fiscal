
import { stuckMoneyMock } from '@/lib/mocks/fiscal-mocks';
import type { StuckMoneyData } from '@/lib/fiscal-types';

export async function getStuckMoney(): Promise<StuckMoneyData> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return stuckMoneyMock;
}

