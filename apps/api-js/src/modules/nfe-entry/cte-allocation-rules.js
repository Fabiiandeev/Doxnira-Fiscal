function cents(value) {
  const normalized = String(value ?? "0").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("CTE_ALLOCATION_INVALID_VALUE");
  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2)) * Math.sign(Number(whole) || 1);
}

function money(value) { return (value / 100).toFixed(2); }

export function calculateCteAllocation({ method, allocatableValue, documents, manualAllocations = [] }) {
  const total = cents(allocatableValue);
  if (total <= 0) throw new Error("CTE_ALLOCATION_ALLOCATABLE_VALUE_REQUIRED");
  if (!documents?.length) throw new Error("CTE_ALLOCATION_NFE_REQUIRED");
  const stable = [...documents].sort((a, b) =>
    String(a.accessKey || "").localeCompare(String(b.accessKey || ""))
    || String(a.number || "").localeCompare(String(b.number || ""))
    || String(a.series || "").localeCompare(String(b.series || ""))
    || String(a.id).localeCompare(String(b.id)),
  );
  const bases = stable.map((document) => {
    const base = method === "VALUE" ? cents(document.productsAmount ?? document.totalAmount)
      : method === "QUANTITY" ? Number(document.quantity || 0)
        : method === "WEIGHT" ? Number(document.weight || 0)
          : method === "VOLUME" ? Number(document.volume || 0) : 0;
    return { ...document, base };
  });
  if (method === "MANUAL") {
    const values = new Map(manualAllocations.map((item) => [String(item.nfeEntryId), cents(item.value)]));
    const allocated = stable.map((document) => ({ ...document, allocatedCents: values.get(String(document.id)) ?? 0, base: 0 }));
    const sum = allocated.reduce((value, item) => value + item.allocatedCents, 0);
    if (allocated.some((item) => item.allocatedCents < 0) || sum !== total) throw new Error("CTE_ALLOCATION_TOTAL_MISMATCH");
    return { method, allocatableValue: money(total), allocatedValue: money(sum), residualValue: "0.00", documents: allocated.map((item) => ({ nfeEntryId: item.id, calculationBase: "0", percentage: "0.000000", calculatedValue: money(item.allocatedCents), residualAdjustment: "0.00", allocatedValue: money(item.allocatedCents) })) };
  }
  const totalBase = bases.reduce((value, item) => value + item.base, 0);
  if (totalBase <= 0) throw new Error(`CTE_ALLOCATION_${method}_BASE_REQUIRED`);
  const allocated = bases.map((item) => ({ ...item, allocatedCents: Math.floor((total * item.base) / totalBase) }));
  const residual = total - allocated.reduce((value, item) => value + item.allocatedCents, 0);
  allocated[0].allocatedCents += residual;
  return { method, allocatableValue: money(total), allocatedValue: money(total), residualValue: money(residual), documents: allocated.map((item, index) => ({ nfeEntryId: item.id, calculationBase: String(item.base), percentage: ((item.base / totalBase) * 100).toFixed(6), calculatedValue: money(item.allocatedCents - (index === 0 ? residual : 0)), residualAdjustment: money(index === 0 ? residual : 0), allocatedValue: money(item.allocatedCents) })) };
}
