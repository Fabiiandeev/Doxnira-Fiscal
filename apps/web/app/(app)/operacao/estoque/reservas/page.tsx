import { InventoryView } from "@/components/operation/inventory/inventory-view";
export const metadata = { title: "Reservas de estoque" };
export default function Page() { return <InventoryView mode="reservations" />; }
