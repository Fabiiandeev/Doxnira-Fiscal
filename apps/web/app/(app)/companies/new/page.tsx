import type { Metadata } from "next";

import { CompanyFormView } from "@/components/companies/company-form-view";

export const metadata: Metadata = { title: "Nova empresa" };

export default function NewCompanyPage() {
  return <CompanyFormView />;
}
