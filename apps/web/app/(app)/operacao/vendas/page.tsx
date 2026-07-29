import { OrdersView } from "@/components/operation/orders/orders-view";
export const metadata = { title: "Vendas" };
export default function Page() { return <OrdersView kind="sales" />; }
