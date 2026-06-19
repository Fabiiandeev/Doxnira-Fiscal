"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ChartCard } from "@/components/chart-card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export function DashboardCharts({
  monthly,
  xml,
  suppliers,
}: {
  monthly: Array<{ month: string; documents: number; totalAmount: number }>;
  xml: Array<{ name: string; value: number; percentage: number }>;
  suppliers: Array<{ issuerName: string; documents: number; totalAmount: number }>;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState<3 | 6>(6);
  const colors = ["#E8FF5A", "#D9D2FF"];
  const visibleMonthly = period === 3 ? monthly.slice(-3) : monthly;
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <ChartCard
        title="Fluxo de documentos"
        description="Volume fiscal por período"
        action={
          <div className="flex gap-1">
            <Button size="sm" variant={period === 3 ? "default" : "outline"} onClick={() => setPeriod(3)}>3 meses</Button>
            <Button size="sm" variant={period === 6 ? "default" : "outline"} onClick={() => setPeriod(6)}>6 meses</Button>
          </div>
        }
      >
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visibleMonthly} margin={{ left: -20, right: 8 }}>
              <defs>
                <linearGradient id="fiscalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E8FF5A" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#E8FF5A" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#EAEAE6" strokeDasharray="4 4" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value, name) => name === "totalAmount" ? formatCurrency(Number(value)) : value} />
              <Area type="monotone" dataKey="documents" stroke="#252525" strokeWidth={3} fill="url(#fiscalGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Cobertura dos XMLs" description="Completos e resumos armazenados">
        <div className="relative h-[210px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={xml}
                dataKey="value"
                innerRadius={62}
                outerRadius={88}
                paddingAngle={4}
                stroke="none"
                onClick={(_, index) => router.push(`/documents?xmlType=${index === 0 ? "FULL" : "SUMMARY"}`)}
                className="cursor-pointer"
              >
                {xml.map((item, index) => <Cell key={item.name} fill={colors[index]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-2xl font-extrabold">{(xml[0]?.percentage || 0).toFixed(1)}%</p>
              <p className="text-[10px] font-bold text-subtle">completos</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {xml.map((item, index) => (
            <div key={item.name} className="rounded-xl bg-muted p-3">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colors[index] }} />
              <p className="mt-2 text-[10px] font-bold text-subtle">{item.name}</p>
              <p className="mt-1 text-lg font-extrabold">{item.value}</p>
            </div>
          ))}
        </div>
      </ChartCard>

      <div className="xl:col-span-2">
        <ChartCard title="Maiores fornecedores" description="Volume financeiro por emitente">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={suppliers} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid horizontal={false} stroke="#EEEEEA" />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="issuerName" width={150} axisLine={false} tickLine={false} tick={{ fontSize: 9 }} tickFormatter={(value) => String(value).split(" ").slice(0, 2).join(" ")} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="totalAmount" fill="#E8FF5A" radius={[0, 8, 8, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
