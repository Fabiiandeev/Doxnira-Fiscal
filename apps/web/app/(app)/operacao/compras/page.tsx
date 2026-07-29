import { OrdersView } from "@/components/operation/orders/orders-view";
export const metadata = { title: "Compras" };
export default function Page() { return <OrdersView kind="purchases" />; }
