"use client";
import { use } from "react";
import { OrderDetail } from "@/components/operation/orders/order-detail";
export default function Page({ params }: { params: Promise<{ id: string }> }) { return <OrderDetail kind="sale" id={use(params).id} />; }
