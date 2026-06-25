"use client";

import { useState, useEffect } from "react";
import { Copy, Package, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSegmentPackages, applySegmentPackage, copyRulesBetweenCompanies } from "@/lib/services/fiscal/segment-rules-service";
import type { SegmentPackage } from "@/lib/fiscal-types";
import { notify } from "@/components/toast-viewport";

export function SegmentRulesView() {
  const [packages, setPackages] = useState<SegmentPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const load = async () => { setLoading(true); const d = await getSegmentPackages(); setPackages(d); setLoading(false); };
    load();
  }, []);

  const handleApply = async (pkg: SegmentPackage) => {
    await applySegmentPackage(pkg.id, "comp-1");
    notify({ title: "Pacote aplicado", description: `${pkg.name} aplicado na empresa atual` });
  };

  const handleCopy = async (pkg: SegmentPackage) => {
    await copyRulesBetweenCompanies("comp-1", "comp-2");
    notify({ title: "Regras copiadas", description: `${pkg.name} copiado para Beta Autopecas` });
  };

  if (loading) return <div className="h-[600px] animate-pulse rounded-2xl bg-white/60" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Pacotes por Segmento</h1><p className="text-sm text-subtle">Regras fiscais pre-configuradas por tipo de negocio</p></div>
        <Button variant="lime" onClick={() => setShowCreate(true)}><Package className="h-4 w-4" /> Criar pacote</Button>
      </div>

      {showCreate && (
        <Card className="p-4 mb-4">
          <h3 className="font-bold mb-3">Novo pacote personalizado</h3>
          <div className="space-y-3">
            <input placeholder="Nome do segmento" className="h-10 rounded-xl border border-line bg-white px-3 w-full" />
            <textarea placeholder="Descricao" className="h-24 rounded-xl border border-line bg-white px-3 w-full" />
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button><Button variant="lime">Criar</Button></div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {packages.map((pkg) => (
          <Card key={pkg.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div><Package className="h-5 w-5 inline mr-2" /><span className="font-bold">{pkg.name}</span></div>
              <Badge variant="outline">{pkg.commonNcms.length} NCMs</Badge>
            </div>
            <p className="text-sm text-subtle mb-3">{pkg.description}</p>

            <div className="space-y-3 mb-4">
              <div><span className="font-medium text-xs">NCMs:</span><div className="flex flex-wrap gap-1 mt-1">{pkg.commonNcms.map(n => <Badge key={n} variant="outline" className="text-xs">{n}</Badge>)}</div></div>
              <div><span className="font-medium text-xs">CFOPs:</span><div className="flex flex-wrap gap-1 mt-1">{pkg.commonCfops.map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}</div></div>
              <div><span className="font-medium text-xs">CSTs:</span><div className="flex flex-wrap gap-1 mt-1">{pkg.commonCsts.map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}</div></div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <Button variant="lime" size="sm" onClick={() => handleApply(pkg)}><Target className="h-3.5 w-3.5" /> Aplicar</Button>
              <Button variant="outline" size="sm" onClick={() => handleCopy(pkg)}><Copy className="h-3.5 w-3.5" /> Copiar regras</Button>
              <Button variant="ghost" size="sm">Revisar regras</Button>
              <Button variant="ghost" size="sm">Enviar contador</Button>
            </div>

            <details className="text-xs text-subtle">
              <summary className="cursor-pointer mb-2">Ver checklist e alertas</summary>
              <div className="space-y-1">
                <p><strong>Pendencias:</strong> {pkg.commonPendencies.join(", ")}</p>
                <p><strong>Regras estoque:</strong> {pkg.stockRules.join(", ")}</p>
                <p><strong>Checklist:</strong> {pkg.fiscalChecklist.join(", ")}</p>
                <p><strong>Alertas:</strong> {pkg.customAlerts.join(", ")}</p>
              </div>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}

