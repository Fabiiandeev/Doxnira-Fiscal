export const CLOSING_SOURCES = ["REAL_SEFAZ", "MANUAL_IMPORT", "ERP_IMPORT"];
export const IGNORED_CLOSING_SOURCES = ["MOCK", "SEED"];

export function closingPeriod(year, month) {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

export function decimal(value) {
  return Number(value || 0);
}

export function sumDocuments(documents, field) {
  return documents.reduce((total, document) => total + decimal(document[field]), 0);
}
