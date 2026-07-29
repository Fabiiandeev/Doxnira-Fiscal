"use client";

import { AlertTriangle, CheckCircle2, RefreshCw, Route, Send, Truck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  mdfeService,
  type EligibleNfe,
  type EligibleNfeResponse,
  type PreparedMdfeGroup,
} from "@/lib/services/mdfe-service";
import { MdfeFormView } from "./mdfe-form-view";

const issueLabels: Record<string, string> = {
  VEHICLE_REQUIRED: "Selecione o veículo",
  DRIVER_REQUIRED: "Selecione o condutor",
  ROUTE_CONFIRMATION_REQUIRED: "Confirme o percurso sugerido",
  PREDOMINANT_PRODUCT_REQUIRED: "Informe o produto predominante",
  PREDOMINANT_PRODUCT_CONFIRMATION_REQUIRED: "Confirme o produto predominante",
  CERTIFICATE_REQUIRED: "Configure um certificado A1 válido",
};

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function MdfeNewView() {
  const searchParams = useSearchParams();
  const requestedNfeId = searchParams?.get("nfeId") || null;
  const [mode, setMode] = useState<"quick" | "advanced">("quick");
  const [result, setResult] = useState<EligibleNfeResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prepared, setPrepared] = useState<PreparedMdfeGroup[]>([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [cityCode, setCityCode] = useState("");
  const [issueDateFrom, setIssueDateFrom] = useState("");
  const [issueDateTo, setIssueDateTo] = useState("");
  const [eligibilityStatus, setEligibilityStatus] = useState("");
  const [reservationStatus, setReservationStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedRoutes, setConfirmedRoutes] = useState<Set<string>>(new Set());
  const [confirmedProducts, setConfirmedProducts] = useState<Set<string>>(new Set());
  const preparationKey = useRef(crypto.randomUUID());
  const initialSelectionApplied = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ pageSize: "100" });
      if (search) query.set("search", search);
      if (state) query.set("destinationState", state);
      if (cityCode) query.set("destinationCityCode", cityCode);
      if (issueDateFrom) query.set("issueDateFrom", issueDateFrom);
      if (issueDateTo) query.set("issueDateTo", issueDateTo);
      if (eligibilityStatus) query.set("eligibilityStatus", eligibilityStatus);
      if (reservationStatus) query.set("reservationStatus", reservationStatus);
      const response = await mdfeService.eligibleNfes(query.toString());
      setResult(response);
      if (requestedNfeId && !initialSelectionApplied.current
        && response.data.some((item) => item.id === requestedNfeId)) {
        setSelected(new Set([requestedNfeId]));
        initialSelectionApplied.current = true;
      }
    } catch (error) {
      notify({ title: "Fila não carregada", description: (error as Error).message, tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [
    cityCode,
    eligibilityStatus,
    issueDateFrom,
    issueDateTo,
    requestedNfeId,
    reservationStatus,
    search,
    state,
  ]);

  useEffect(() => { void load(); }, [load]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectState(destinationState: string) {
    const ids = (result?.data || [])
      .filter((item) => item.destinationState === destinationState)
      .map((item) => item.id);
    setSelected(new Set(ids));
    setState(destinationState);
  }

  async function prepare() {
    if (!selected.size) return;
    setSubmitting(true);
    try {
      const response = await mdfeService.prepareFromNfes([...selected], preparationKey.current);
      setPrepared(response.groups);
      notify({
        title: `${response.groupCount} MDF-e preparado(s)`,
        description: "Os documentos foram agrupados e reservados no backend.",
        tone: "success",
      });
    } catch (error) {
      notify({ title: "Preparação bloqueada", description: (error as Error).message, tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function reevaluate(nfeId: string) {
    setSubmitting(true);
    try {
      await mdfeService.reevaluateNfe(nfeId);
      await load();
      notify({ title: "Elegibilidade atualizada", tone: "success" });
    } catch (error) {
      notify({ title: "Reavaliação bloqueada", description: (error as Error).message, tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function authorize(group: PreparedMdfeGroup) {
    setSubmitting(true);
    try {
      await mdfeService.saveAndAuthorize(group.mdfeId, crypto.randomUUID(), {
        confirmRoute: confirmedRoutes.has(group.mdfeId),
        confirmPredominantProduct: confirmedProducts.has(group.mdfeId),
      });
      notify({ title: "MDF-e enviado para autorização", tone: "success" });
      await load();
    } catch (error) {
      notify({
        title: "Transmissão bloqueada com segurança",
        description: (error as Error).message,
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "advanced") {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setMode("quick")}>Voltar à emissão rápida</Button>
        </div>
        <MdfeFormView />
      </div>
    );
  }

  const notes: EligibleNfe[] = result?.data || [];
  const picked = notes.filter((item) => selected.has(item.id));
  const pickedTotal = picked.reduce((sum, item) => sum + item.totalAmountCents, 0);
  const pickedWeight = picked.reduce((sum, item) => sum + item.grossWeight, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Documentos aguardando MDF-e"
        title="Emitir MDF-e"
        description="Selecione NF-e autorizadas. Dados fiscais, agrupamento e totais são recarregados pelo backend."
        icon={Truck}
        action={<Button variant="outline" onClick={() => setMode("advanced")}>Preenchimento avançado</Button>}
      />

      <Card className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_130px_150px_150px_170px_190px_auto]">
        <input
          className="h-11 rounded-xl border border-line px-3 text-sm"
          placeholder="Número, chave ou cliente"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="h-11 rounded-xl border border-line px-3 text-sm"
          value={state}
          onChange={(event) => setState(event.target.value)}
        >
          <option value="">Todas as UFs</option>
          {(result?.summary || []).map((item) => <option key={item.state}>{item.state}</option>)}
        </select>
        <input
          className="h-11 rounded-xl border border-line px-3 text-sm"
          placeholder="IBGE destino"
          value={cityCode}
          onChange={(event) => setCityCode(event.target.value.replace(/\D/g, "").slice(0, 7))}
        />
        <input
          aria-label="Emissão inicial"
          className="h-11 rounded-xl border border-line px-3 text-sm"
          type="date"
          value={issueDateFrom}
          onChange={(event) => setIssueDateFrom(event.target.value)}
        />
        <input
          aria-label="Emissão final"
          className="h-11 rounded-xl border border-line px-3 text-sm"
          type="date"
          value={issueDateTo}
          onChange={(event) => setIssueDateTo(event.target.value)}
        />
        <select
          className="h-11 rounded-xl border border-line px-3 text-sm"
          value={eligibilityStatus}
          onChange={(event) => setEligibilityStatus(event.target.value)}
        >
          <option value="">Elegíveis e liberadas</option>
          <option value="ELIGIBLE">Elegíveis</option>
          <option value="INELIGIBLE">Inelegíveis</option>
          <option value="LINKED_TO_DRAFT">Em rascunho</option>
        </select>
        <select
          className="h-11 rounded-xl border border-line px-3 text-sm"
          value={reservationStatus}
          onChange={(event) => setReservationStatus(event.target.value)}
        >
          <option value="">Todas as reservas</option>
          <option value="RESERVED">Reservadas</option>
          <option value="LINKED_TO_DRAFT">Em rascunho</option>
          <option value="RELEASED">Liberadas</option>
        </select>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Atualizar
        </Button>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {(result?.summary || []).map((item) => (
          <button key={item.state} type="button" onClick={() => selectState(item.state)} className="text-left">
            <Card className={`p-4 transition ${state === item.state ? "ring-2 ring-lime-400" : "hover:border-ink/30"}`}>
              <div className="flex items-center justify-between">
                <b className="text-lg">{item.state}</b>
                <Badge variant="success">{item.documentCount} NF-e</Badge>
              </div>
              <p className="mt-2 text-sm">{item.municipalityCount} município(s)</p>
              <p className="text-sm font-bold">{money(item.totalAmountCents)}</p>
              <p className="text-xs text-subtle">{item.grossWeight.toLocaleString("pt-BR")} kg</p>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-muted">
              <tr>{["", "NF-e", "Autorização", "Cliente", "Destino", "Valor", "Peso/volumes", "Status", "Ações"].map((label) => <th key={label} className="p-3 text-left">{label}</th>)}</tr>
            </thead>
            <tbody>
              {notes.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="p-3"><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} /></td>
                  <td className="p-3"><b>{item.number}/{item.series}</b><p className="font-mono text-[10px]">{item.accessKey}</p></td>
                  <td className="p-3">{item.authorizedAt ? new Date(item.authorizedAt).toLocaleString("pt-BR") : "—"}</td>
                  <td className="p-3">{item.customerName}</td>
                  <td className="p-3">{item.destinationCityName}/{item.destinationState}</td>
                  <td className="p-3">{money(item.totalAmountCents)}</td>
                  <td className="p-3">{item.grossWeight.toLocaleString("pt-BR")} kg<p className="text-xs text-subtle">{item.packageQuantity} volume(s)</p></td>
                  <td className="p-3">
                    <Badge variant={item.eligibilityStatus === "INELIGIBLE" ? "warning" : "success"}>{item.eligibilityStatus}</Badge>
                    {item.eligibilityReason && <p className="mt-1 max-w-48 text-xs text-amber-800">{item.eligibilityReason}</p>}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button asChild size="sm" variant="ghost"><Link href={`/emitir-nota?id=${item.id}`}>Abrir</Link></Button>
                      <Button size="sm" variant="ghost" disabled={submitting} onClick={() => reevaluate(item.id)}>Atualizar</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !notes.length && <tr><td colSpan={9} className="p-10 text-center text-subtle">Nenhuma NF-e elegível para transporte.</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card className="h-fit space-y-4 p-5 xl:sticky xl:top-4">
          <div><p className="text-xs font-bold uppercase text-subtle">Resumo</p><h2 className="text-xl font-extrabold">{selected.size} NF-e selecionada(s)</h2></div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-subtle">Valor total</p><b>{money(pickedTotal)}</b></div>
            <div><p className="text-subtle">Peso bruto</p><b>{pickedWeight.toLocaleString("pt-BR")} kg</b></div>
            <div><p className="text-subtle">UFs</p><b>{new Set(picked.map((item) => item.destinationState)).size}</b></div>
            <div><p className="text-subtle">Municípios</p><b>{new Set(picked.map((item) => item.destinationCityCode)).size}</b></div>
          </div>
          <Button className="w-full" variant="lime" disabled={!selected.size || submitting} onClick={prepare}>
            <Route className="h-4 w-4" />Preparar MDF-e
          </Button>
          <Button className="w-full" variant="outline" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
        </Card>
      </div>

      {prepared.map((group) => (
        <Card key={group.mdfeId} className="p-5">
          {(() => {
            const routeConfirmed = confirmedRoutes.has(group.mdfeId);
            const productConfirmed = confirmedProducts.has(group.mdfeId);
            const unresolvedIssues = group.blockingIssues.filter((issue) => (
              !(issue === "ROUTE_CONFIRMATION_REQUIRED" && routeConfirmed)
              && !(issue === "PREDOMINANT_PRODUCT_CONFIRMATION_REQUIRED" && productConfirmed)
            ));
            return (
              <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-subtle">Rascunho preparado</p>
              <h3 className="text-lg font-extrabold">{group.loadingState} → {group.unloadingState}</h3>
              <p className="text-sm">{group.documentCount} NF-e · {group.municipalityCount} município(s) · {money(group.totalCargoCents)}</p>
            </div>
            <Badge variant={unresolvedIssues.length ? "warning" : "success"}>
              {unresolvedIssues.length ? `${unresolvedIssues.length} pendência(s)` : "Pronto"}
            </Badge>
          </div>
          {unresolvedIssues.length ? (
            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              <p className="mb-2 flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />Complete somente:</p>
              <ol className="list-inside list-decimal space-y-1">{unresolvedIssues.map((issue) => <li key={issue}>{issueLabels[issue] || issue}</li>)}</ol>
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />MDF-e pronto para transmissão</p>
          )}
          <div className="mt-4 space-y-2 text-sm">
            {group.blockingIssues.includes("ROUTE_CONFIRMATION_REQUIRED") && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={routeConfirmed}
                  onChange={(event) => setConfirmedRoutes((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(group.mdfeId); else next.delete(group.mdfeId);
                    return next;
                  })}
                />
                Confirmo o percurso sugerido pelo fallback determinístico.
              </label>
            )}
            {group.blockingIssues.includes("PREDOMINANT_PRODUCT_CONFIRMATION_REQUIRED") && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={productConfirmed}
                  onChange={(event) => setConfirmedProducts((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(group.mdfeId); else next.delete(group.mdfeId);
                    return next;
                  })}
                />
                Confirmo o produto predominante calculado pelo backend.
              </label>
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button asChild variant="outline"><Link href={`/mdfe/${group.mdfeId}/editar`}>Revisar detalhes</Link></Button>
            <Button variant="lime" disabled={unresolvedIssues.length > 0 || submitting} onClick={() => authorize(group)}>
              <Send className="h-4 w-4" />Salvar e transmitir MDF-e
            </Button>
          </div>
              </>
            );
          })()}
        </Card>
      ))}
    </div>
  );
}
