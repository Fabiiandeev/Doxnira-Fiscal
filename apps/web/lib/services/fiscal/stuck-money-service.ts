import type { StuckMoneyData } from "@/lib/fiscal-types";

const emptyStuckMoney: StuckMoneyData = {
  totalStuck: 0,
  byCategory: [],
  topDocuments: [],
  recoveryActions: [],
};

export async function getStuckMoney(): Promise<StuckMoneyData> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return emptyStuckMoney;
}
