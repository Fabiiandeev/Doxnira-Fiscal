import { OrderForm } from "@/components/operation/orders/order-form";
export const metadata = { title: "Nova venda" };
export default function Page() { return <OrderForm kind="sale" />; }
