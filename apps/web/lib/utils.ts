import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

export const formatDate = (value: string, withTime = false) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));

export const maskCnpj = (value: string) =>
  value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

export const normalizeCnpj = (value: string) =>
  String(value || "").replace(/\D/g, "");

export const normalizeCpf = (value: string) => String(value || "").replace(/\D/g, "");
export const maskCpf = (value: string) => String(value || "").replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

export function formatPhone(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 8) return d.replace(/^(\d{4})(\d{4})$/, "$1-$2");
  if (d.length === 9) return d.replace(/^(\d{5})(\d{4})$/, "$1-$2");
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  return raw;
}
