"use client";

import { useState, useEffect } from "react";
import { Building2, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getNfseNationalStatus, updateNfseItem, prepareCompany, generateNfseReport } from "@/lib/services/fiscal/nfse-national-service";
import type { NfseNationalChecklist } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";

const statusColors: Record<string, string> = { COMPLETE: "bg-green-50 text-green-700", IN_PROGRESS: "bg-yellow-50 text-yellow-700", NOT_STARTED: "bg-muted text-subtle" };
const statusLabels: Record<string, string> = { COMPLETE: "Completo", IN_PROGRESS: "Em andamento", NOT_STARTED: "Nao iniciado" };

export function NfseNationalView() {
  const [data, setData] = useState<NfseNationalChecklist[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const d = await getNfseNationalStatus();
    setData(d);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAction = async (companyId: string, action: string) => {
    if (action === "prepare") { await prepareCompany(companyId); notify({ title: "Empresa preparada" }); }
    if (action === "generate_report") { await generateNfseReport(companyId); notify({ title: "Relatorio gerado" }); }
    const d = await getNfseNationalStatus();
    setData(d);
  };

  if (loading) return <div className="h-[600px] animate-pulse rounded-2xl bg-white/60" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Adequacao NFS-e Nacional</h1><p className="text-sm text-subtle">Checklist de conformidade para o padrao nacional</p></div>
        <Button variant="lime" onClick={loadData}><Target className="h-4 w-4" /> Atualizar</Button>
      </div>

      {data.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto mb-3 text-subtle" />
          <h2 className="text-xl font-bold text-ink mb-2">Nenhuma empresa encontrada</h2>
          <p className="text-sm text-subtle max-w-md mx-auto mb-4">
            Cadastre empresas e configure dados NFS-e para verificar a adequacao ao padrao nacional.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button variant="lime" onClick={() => window.location.href = "/companies"}>Cadastrar empresa</Button>
            <Button variant="outline" onClick={() => window.location.href = "/nfse-national"}>Sincronizar dados</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.map((company) => (
            <Card key={company.companyId} className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div><Building2 className="h-4 w-4 inline mr-2" />{company.companyName}</div>
                <Badge className={statusColors[company.status]}>{statusLabels[company.status] || company.status}</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 mb-4">
                <div className="p-3 rounded-xl bg-white border border-line"><p className="text-xs text-subtle">Prestador cadastrado</p><p className="text-2xl font-extrabold">{company.providerRegistered ? "Sim" : "Nao"}</p></div>
                <div className="p-3 rounded-xl bg-white border border-line"><p className="text-xs text-subtle">Servicos cadastrados</p><p className="text-2xl font-extrabold">{company.servicesRegistered}</p></div>
                <div className="p-3 rounded-xl bg-white border border-line"><p className="text-xs text-subtle">Codigo nacional pendente</p><p className="text-2xl font-extrabold text-red-500">{company.nationalCodePending}</p></div>
                <div className="p-3 rounded-xl bg-white border border-line"><p className="text-xs text-subtle">Municipio pendente</p><p className="text-2xl font-extrabold text-orange-500">{company.municipalityPending}</p></div>
                <div className="p-3 rounded-xl bg-white border border-line"><p className="text-xs text-subtle">Retencoes nao config.</p><p className="text-2xl font-extrabold text-red-500">{company.retentionsNotConfigured}</p></div>
                <div className="p-3 rounded-xl bg-white border border-line"><p className="text-xs text-subtle">Tomadores incompletos</p><p className="text-2xl font-extrabold text-orange-500">{company.incompleteTakners}</p></div>
              </div>

              <div className="flex flex-wrap gap-2">
                {!company.providerRegistered && (
                  <Button variant="outline" size="sm" onClick={() => handleAction(company.companyId, "prepare")}>Preparar empresa</Button>
                )}
                {company.nationalCodePending > 0 && (
                  <Button variant="outline" size="sm" onClick={async () => { await updateNfseItem(company.companyId, { nationalCodePending: Math.max(0, company.nationalCodePending - 1) }); notify({ title: "Codigo atualizado" }); const d = await getNfseNationalStatus(); setData(d); }}>Resolver 1 codigo</Button>
                )}
                <Button variant="lime" size="sm" onClick={() => handleAction(company.companyId, "generate_report")}>Gerar relatorio</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
