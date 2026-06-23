import { createHash } from "node:crypto";

const ufCodes = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
  SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41",
  SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};

export function calculateNfeAccessKeyDigit(base) {
  let weight = 2;
  let sum = 0;
  for (let index = base.length - 1; index >= 0; index -= 1) {
    sum += Number(base[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const digit = 11 - (sum % 11);
  return digit === 10 || digit === 11 ? 0 : digit;
}

export function isValidNfeAccessKey(value) {
  const key = String(value || "").replace(/\D/g, "");
  if (key.length !== 44) return false;
  const month = Number(key.slice(4, 6));
  const year = Number(key.slice(2, 4));
  const currentYear = Number(String(new Date().getFullYear()).slice(-2));
  if (month < 1 || month > 12 || year < 6 || year > currentYear + 1) return false;
  if (!["55", "57"].includes(key.slice(20, 22))) return false;
  return calculateNfeAccessKeyDigit(key.slice(0, 43)) === Number(key[43]);
}

export function buildMockNfeAccessKey({
  uf,
  issuerCnpj,
  invoiceNumber,
  series = "1",
  model = "55",
  issuedAt = new Date(),
  seed = "",
}) {
  const cuf = ufCodes[String(uf || "").toUpperCase()] || "91";
  const aamm = `${String(issuedAt.getFullYear()).slice(-2)}${String(
    issuedAt.getMonth() + 1,
  ).padStart(2, "0")}`;
  const cnpj = String(issuerCnpj || "").replace(/\D/g, "").padStart(14, "0").slice(-14);
  const number = String(invoiceNumber || "0").replace(/\D/g, "").padStart(9, "0").slice(-9);
  const normalizedSeries = String(series).replace(/\D/g, "").padStart(3, "0").slice(-3);
  const numericCode = String(
    BigInt(`0x${createHash("sha256").update(`${seed}:${invoiceNumber}`).digest("hex").slice(0, 12)}`) %
      100_000_000n,
  ).padStart(8, "0");
  const normalizedModel = ["55", "57"].includes(String(model)) ? String(model) : "55";
  const base = `${cuf}${aamm}${cnpj}${normalizedModel}${normalizedSeries}${number}1${numericCode}`;
  return `${base}${calculateNfeAccessKeyDigit(base)}`;
}
