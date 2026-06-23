"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/utils";

export function TaxDonut({
  data,
  total,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  total: number;
}) {
  return (
    <div className="relative h-[235px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={58} outerRadius={82} stroke="none">
            {data.map((item) => <Cell key={item.name} fill={item.color} />)}
          </Pie>
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[78px] text-center">
        <p className="text-[10px] font-bold text-subtle">Total estimado</p>
        <p className="mt-1 text-sm font-extrabold">{formatCurrency(total)}</p>
      </div>
    </div>
  );
}

export function MonthlyRevenueChart({
  data,
}: {
  data: Array<{ month: string; inbound: number; outbound: number }>;
}) {
  return (
    <div className="h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -22, right: 8, top: 10 }}>
          <defs>
            <linearGradient id="outboundFlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#50d86b" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#50d86b" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#ecece8" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Area type="monotone" dataKey="outbound" name="Saídas" stroke="#28b84b" strokeWidth={2.5} fill="url(#outboundFlow)" />
          <Area type="monotone" dataKey="inbound" name="Entradas" stroke="#7c5ce5" strokeWidth={2} fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ClosingStatusDonut({
  ready,
  pending,
  total,
}: {
  ready: number;
  pending: number;
  total: number;
}) {
  const reviewing = Math.max(total - ready - pending, 0);
  const data = [
    { name: "Prontas", value: ready, color: "#50d86b" },
    { name: "Em análise", value: reviewing, color: "#3b82f6" },
    { name: "Pendências", value: pending, color: "#f97316" },
  ];
  return (
    <div className="relative h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={55} outerRadius={78} stroke="none">
            {data.map((item) => <Cell key={item.name} fill={item.color} />)}
          </Pie>
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[74px] text-center">
        <p className="text-xl font-extrabold">{total}</p>
        <p className="text-[9px] font-bold text-subtle">empresas</p>
      </div>
    </div>
  );
}
