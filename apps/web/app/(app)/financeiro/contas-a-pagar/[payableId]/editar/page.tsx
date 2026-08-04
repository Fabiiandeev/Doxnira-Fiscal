import { PayableForm } from "@/components/financial/payables/payable-ui";
export const metadata = { title: "Editar conta a pagar" };
export default async function Page({params}:{params:Promise<{payableId:string}>}){const {payableId}=await params;return <PayableForm payableId={payableId}/>}
