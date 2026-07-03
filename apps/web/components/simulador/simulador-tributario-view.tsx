"use client";

import { useQuery } from "@tanstack/react-query";
import { Calculator, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getTaxSettings } from "@/lib/services/tax-service";
import { simulateFiscal } from "@/lib/services/product-service";
import type { CrtValue } from "@/lib/types";
import type { FiscalSimulationResultV2 } from "@/lib/product-types";

type RegimeKey = "simples" | "presumido" | "real";

interface RegimeResult {
  key: RegimeKey;
  label: string;
  crt: CrtValue;
  regime: string;
  result: FiscalSimulationResultV2 | null;
  loading: boolean;
  error: string | null;
}

const REGIME_CONFIG: { key: RegimeKey; label: string; crt: CrtValue; regime: string }[] = [
  { key: "simples", label: "Simples Nacional", crt: "1", regime: "simples" },
  { key: "presumido", label: "Lucro Presumido", crt: "3", regime: "presumido" },
  { key: "real", label: "Lucro Real", crt: "3", regime: "real" },
];

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function SimuladorTributarioView() {
  const [ncm, setNcm] = useState("");
  const [ufOrigem, setUfOrigem] = useState("");
  const [ufDestino, setUfDestino] = useState("");
  const [valorProduto, setValorProduto] = useState(1000);
  const [results, setResults] = useState<RegimeResult[]>([]);
  const [simulating, setSimulating] = useState(false);

  const companyId = typeof window !== "undefined"
    ? localStorage.getItem("companyId") || ""
    : "";

  const settingsQuery = useQuery({
    queryKey: ["tax-settings", companyId],
    queryFn: () => getTaxSettings(companyId),
    enabled: !!companyId,
  });

  const settings = settingsQuery.data;

  const runSimulation = async () => {
    const cleanNcm = ncm.replace(/\D/g, "");
    if (cleanNcm.length !== 8) return;
    if (!ufOrigem || !ufDestino) return;

    setSimulating(true);
    const regimeResults: RegimeResult[] = [];

    for (const config of REGIME_CONFIG) {
      regimeResults.push({ ...config, result: null, loading: true, error: null });
    }
    setResults(regimeResults);

    const promises = REGIME_CONFIG.map(async (config, idx) => {
      try {
        const result = await simulateFiscal({
          ncm: cleanNcm,
          ufOrigem,
          ufDestino,
          crt: config.crt,
          regime: config.regime,
          tipoOperacao: "venda_mercadoria",
          consumidorFinal: true,
          contribuinteIcms: config.key !== "simples",
          finalidade: "normal",
          valorProduto,
          frete: 0,
          seguro: 0,
          desconto: 0,
        });
        regimeResults[idx] = { ...config, result, loading: false, error: null };
      } catch (e) {
        regimeResults[idx] = {
          ...config,
          result: null,
          loading: false,
          error: e instanceof Error ? e.message : "Erro na simulação",
        };
      }
    });

    await Promise.all(promises);
    setResults([...regimeResults]);
    setSimulating(false);
  };

  const bestRegime = results.length >= 3 && results.every((r) => !r.loading)
    ? results.reduce((best, curr) => {
        const bestTotal = best.result?.totals?.totalTributos ?? Infinity;
        const currTotal = curr.result?.totals?.totalTributos ?? Infinity;
        return currTotal < bestTotal ? curr : best;
      })
    : null;

  const configuredRegime = settings?.taxRegime || "";

  return (
    <>
      <PageHeader
        eyebrow="Simulação fiscal"
        title="Simulador Tributário"
        description="Compare a carga tributária entre os 3 regimes para uma mesma operação."
        icon={Calculator}
      />
      <Card className="mb-4 p-5 md:p-6">
        <h2 className="text-sm font-extrabold">Dados da operação</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label>
            <span className="mb-2 block text-[11px] font-extrabold">NCM</span>
            <Input
              maxLength={8}
              placeholder="80089090"
              value={ncm}
              onChange={(e) => setNcm(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label>
            <span className="mb-2 block text-[11px] font-extrabold">UF Origem</span>
            <Input
              maxLength={2}
              placeholder="MG"
              value={ufOrigem}
              onChange={(e) => setUfOrigem(e.target.value.toUpperCase())}
            />
          </label>
          <label>
            <span className="mb-2 block text-[11px] font-extrabold">UF Destino</span>
            <Input
              maxLength={2}
              placeholder="SP"
              value={ufDestino}
              onChange={(e) => setUfDestino(e.target.value.toUpperCase())}
            />
          </label>
          <label>
            <span className="mb-2 block text-[11px] font-extrabold">Valor do produto (R$)</span>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={valorProduto}
              onChange={(e) => setValorProduto(Number(e.target.value) || 0)}
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            variant="lime"
            onClick={runSimulation}
            disabled={simulating || ncm.replace(/\D/g, "").length !== 8 || !ufOrigem || !ufDestino || valorProduto <= 0}
          >
            {simulating ? "Simulando..." : "Simular os 3 regimes"}
          </Button>
        </div>
      </Card>

      {results.length > 0 && (
        <>
          {bestRegime?.result && (
            <Card className="mb-4 p-5 md:p-6 bg-emerald-50 border-emerald-200">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-emerald-700" />
                <h2 className="text-sm font-extrabold text-emerald-900">
                  Menor carga tributária: {bestRegime.label}
                </h2>
              </div>
              <p className="mt-1 text-[11px] text-emerald-800">
                Total de tributos: {formatCurrency(bestRegime.result.totals.totalTributos)} ({bestRegime.result.totals.percentualCarga.toFixed(2)}% do valor)
                {configuredRegime && configuredRegime !== "PENDENTE_CONFIRMACAO" && (
                  <> — Regime atual da empresa: <strong>{regimeLabel(configuredRegime)}</strong></>
                )}
              </p>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {results.map((r) => (
              <RegimeCard
                key={r.key}
                result={r}
                isBest={bestRegime?.key === r.key}
                isCurrent={
                  (r.key === "simples" && (configuredRegime === "SIMPLES_NACIONAL" || configuredRegime === "MEI"))
                  || (r.key === "presumido" && configuredRegime === "LUCRO_PRESUMIDO")
                  || (r.key === "real" && configuredRegime === "LUCRO_REAL")
                }
              />
            ))}
          </div>
        </>
      )}

      {settings && !settings.fiscalConfigComplete && (
        <Card className="mt-4 border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold text-amber-800">
            Configuração fiscal incompleta — os resultados podem conter PENDING_RULE. Complete a configuração fiscal para resultados mais precisos.
          </p>
        </Card>
      )}
    </>
  );
}

function RegimeCard({ result, isBest, isCurrent }: { result: RegimeResult; isBest: boolean; isCurrent: boolean }) {
  const { label, result: simResult, loading, error } = result;

  return (
    <Card className={`p-5 ${isBest ? "ring-2 ring-emerald-400" : ""} ${isCurrent ? "ring-2 ring-ink" : ""}`}>
      <div className="flex items-center gap-2">
        {isBest ? (
          <TrendingDown className="h-4 w-4 text-emerald-600" />
        ) : isCurrent ? (
          <Minus className="h-4 w-4 text-ink" />
        ) : (
          <TrendingUp className="h-4 w-4 text-subtle" />
        )}
        <h3 className="text-xs font-extrabold">{label}</h3>
        {isCurrent && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">Atual</span>}
        {isBest && !isCurrent && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Menor</span>}
      </div>

      {loading && (
        <div className="mt-4 space-y-2">
          <div className="h-4 animate-pulse rounded bg-muted" />
          <div className="h-4 animate-pulse rounded bg-muted w-3/4" />
        </div>
      )}

      {error && (
        <p className="mt-3 text-[11px] text-red-600">{error}</p>
      )}

      {simResult && (
        <div className="mt-3">
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-[11px] font-bold text-subtle">CFOP</span>
            <span className="text-sm font-extrabold">{simResult.cfop.selectedCfop || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-line py-2">
            <span className="text-[11px] font-bold text-subtle">CST/CSOSN</span>
            <span className="text-sm font-extrabold">{simResult.cstCsosn.codigo || "—"}</span>
          </div>

          {Object.entries(simResult.taxes).map(([taxKey, line]) => (
            <div key={taxKey} className="flex justify-between border-b border-line py-1.5">
              <span className="text-[11px] text-subtle">{line.tax || taxKey.toUpperCase()}</span>
              <div className="text-right">
                <span className={`text-xs font-bold ${line.status === "CALCULATED" ? "text-ink" : line.status === "ZERO_BY_REGIME" ? "text-emerald-600" : "text-amber-600"}`}>
                  {line.status === "CALCULATED" && line.value != null
                    ? formatCurrency(line.value)
                    : line.status === "ZERO_BY_REGIME"
                      ? "R$ 0,00 (isento)"
                      : "PENDENTE"}
                </span>
                {line.status === "CALCULATED" && line.rate != null && (
                  <span className="ml-1 text-[10px] text-subtle">({(line.rate * 100).toFixed(2)}%)</span>
                )}
              </div>
            </div>
          ))}

          <div className="mt-2 flex justify-between rounded-xl bg-surface p-3">
            <span className="text-xs font-extrabold">Total tributos</span>
            <span className="text-sm font-extrabold">{formatCurrency(simResult.totals.totalTributos)}</span>
          </div>
          <div className="flex justify-between px-3 pb-2">
            <span className="text-[10px] text-subtle">Carga tributária</span>
            <span className="text-[11px] font-bold text-subtle">{simResult.totals.percentualCarga.toFixed(2)}%</span>
          </div>

          {simResult.camposPendentes.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
              <p className="text-[10px] font-bold text-amber-700">
                Pendente: {simResult.camposPendentes.join(", ")}
              </p>
            </div>
          )}

          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-subtle">Score:</span>
            <span className="text-[10px] font-bold">{simResult.audit.score}/100</span>
            <span className={`text-[10px] font-bold ${simResult.audit.riskLevel === "LOW" ? "text-emerald-600" : simResult.audit.riskLevel === "MEDIUM" ? "text-amber-600" : "text-red-600"}`}>
              {simResult.audit.riskLabel || simResult.audit.riskLevel}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

function regimeLabel(regime: string): string {
  switch (regime) {
    case "SIMPLES_NACIONAL": return "Simples Nacional";
    case "LUCRO_PRESUMIDO": return "Lucro Presumido";
    case "LUCRO_REAL": return "Lucro Real";
    case "MEI": return "MEI";
    default: return regime;
  }
}
