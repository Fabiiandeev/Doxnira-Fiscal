import { PayableDetail } from "@/components/financial/payables/payable-ui";
export const metadata = { title: "Detalhe da conta a pagar" };
export default async function Page({params}:{params:Promise<{payableId:string}>}){const {payableId}=await params;return <PayableDetail payableId={payableId}/>}
