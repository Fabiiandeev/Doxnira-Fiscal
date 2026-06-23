import { redirect } from "next/navigation";

export default function NewCompanyPage() {
  redirect("/companies?new=1");
}
