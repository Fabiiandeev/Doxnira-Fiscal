import { OrderForm } from "@/components/operation/orders/order-form";
export const metadata = { title: "Nova compra" };
export default function Page() { return <OrderForm kind="purchase" />; }
