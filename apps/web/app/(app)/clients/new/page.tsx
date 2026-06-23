import { ClientForm } from "@/components/clients/client-form";

export default function NewClientPage() {
  // companyId can be taken from context in real app; pass undefined for now
  return <div className="p-6"><h1 className="mb-4 text-2xl font-extrabold">Cadastro de Cliente</h1><ClientForm /></div>;
}
