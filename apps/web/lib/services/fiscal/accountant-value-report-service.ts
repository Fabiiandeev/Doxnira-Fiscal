export type AccountantValueReportItem = {
  id: string;
  label: string;
  value: string;
};

export async function getAccountantValueReport(): Promise<AccountantValueReportItem[]> {
  return [
    { id: "validated-documents", label: "Documentos validados", value: "0" },
    { id: "classified-products", label: "Produtos classificados", value: "0" },
    { id: "fixed-rejections", label: "Rejeicoes corrigidas", value: "0" },
    { id: "linked-cte", label: "CT-e vinculados", value: "0" },
    { id: "checked-guides", label: "Guias conferidas", value: "0" },
    { id: "unlocked-money", label: "Notas destravadas", value: "R$ 0,00" },
  ];
}

export async function generateValueReportPdf(): Promise<{ success: boolean; fileName: string }> {
  return { success: true, fileName: "relatorio-valor-contabilidade.pdf" };
}

export async function sendValueReportToClient(): Promise<{ success: boolean }> {
  return { success: true };
}

export async function exportValueReportCsv(): Promise<{ success: boolean; fileName: string }> {
  return { success: true, fileName: "relatorio-valor-contabilidade.csv" };
}
