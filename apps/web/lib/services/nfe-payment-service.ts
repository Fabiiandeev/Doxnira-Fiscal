export function splitNfeInstallments(total: number, count: number) {
  const safeCount = Math.max(Math.trunc(count) || 1, 1);
  const baseValue = Math.round((total / safeCount + Number.EPSILON) * 100) / 100;
  let accumulated = 0;
  return Array.from({ length: safeCount }, (_, index) => {
    const value = index === safeCount - 1 ? Math.round((total - accumulated + Number.EPSILON) * 100) / 100 : baseValue;
    accumulated = Math.round((accumulated + value + Number.EPSILON) * 100) / 100;
    return value;
  });
}

export function isNfePaymentBalanced(total: number, installments: Array<{ valor: number | string }>) {
  const paid = installments.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  return Math.abs(Number(total || 0) - paid) < 0.01;
}
