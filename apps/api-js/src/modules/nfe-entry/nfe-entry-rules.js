export function money(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildIncomingInventoryPlan(entry) {
  const eligibleItems = (entry.items || []).filter((item) => !item.stockIgnored && item.productId);
  const productsAmount = Math.max(money(entry.productsAmount), 0);
  const additionalCost = money(entry.freightAmount) - money(entry.discountAmount);
  return eligibleItems.map((item) => {
    const itemValue = money(item.totalValue);
    const allocationRatio = productsAmount > 0 ? itemValue / productsAmount : 0;
    const quantity = money(item.quantity);
    const totalCost = Math.max(0, itemValue + additionalCost * allocationRatio);
    return {
      itemId: item.id,
      productId: item.productId,
      quantity,
      allocationRatio,
      freightShare: money(entry.freightAmount) * allocationRatio,
      discountShare: money(entry.discountAmount) * allocationRatio,
      totalCost,
      unitCost: quantity > 0 ? totalCost / quantity : 0,
    };
  });
}

export function validateIncomingPayableInstallments(entry, installments, parseDate = (value) => new Date(value)) {
  const issues = [];
  const seenNumbers = new Set();
  let total = 0;
  for (const installment of installments) {
    const number = String(installment.number || installment.installmentNumber || "001");
    const amount = money(installment.amount);
    const dueDate = parseDate(installment.dueDate);
    if (seenNumbers.has(number)) issues.push(`Parcela ${number} foi informada mais de uma vez.`);
    seenNumbers.add(number);
    if (amount <= 0) issues.push(`Parcela ${number} deve ter valor maior que zero.`);
    if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) issues.push(`Vencimento da parcela ${number} é inválido.`);
    total += amount;
  }
  if (Math.abs(total - money(entry.totalAmount)) > 0.01) issues.push("A soma das parcelas deve ser igual ao valor financeiro da NF-e.");
  return issues;
}

export function incomingInventoryReadiness(entry) {
  const hasBlockingAlert = (entry.alerts || []).some((alert) => alert.severity === "error");
  const pendingItems = (entry.items || []).some((item) => !item.stockIgnored && !item.productId);
  const blocked = Boolean(entry.stockPostedAt) || entry.status === "CANCELADA" || hasBlockingAlert || pendingItems;
  return { status: blocked ? "BLOCKED" : "READY_TO_POST", canPost: !blocked };
}
