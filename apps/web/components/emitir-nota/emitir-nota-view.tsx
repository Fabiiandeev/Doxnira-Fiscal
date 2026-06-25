"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Send, Shield, XCircle, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/components/toast-viewport";
import { formatCurrency } from "@/lib/utils";

export function EmitirNotaView() {
  const [step, setStep] = useState(1);
  const [rejectionRisk, setRejectionRisk] = useState<any>(null);

  const steps = [
    { id: 1, title: "Dados da nota", desc: "Emitente, destinatario, produtos" },
    { id: 2, title: "Produtos", desc: "Itens, NCM, CST, valores" },
    { id: 3, title: "Impostos", desc: "ICMS, IPI, PIS, COFINS" },
    { id: 4, title: "Revisao", desc: "Simulador de rejeicao" },
    { id: 5, title: "Emissao", desc: "Assinar e transmitir" },
  ];

  const simulateRejection = () => {
    const risks = [
      { id: "r1", label: "Cliente sem IE", severity: "CRITICAL", description: "Destinatario sem IE cadastrada", autoFix: true, action: "Cadastrar IE ou indicador 9" },
      { id: "r2", label: "Produto sem CEST", severity: "HIGH", description: "Item com ST sem CEST", autoFix: true, action: "Aplicar CEST sugerido" },
      { id: "r3", label: "Total ICMS divergente", severity: "HIGH", description: "Diferenca de R$ 45,80", autoFix: true, action: "Recalcular automaticamente" },
    ];
    setRejectionRisk({ chance: 18, risks, canEmit: true, criticalBlocking: false });
  };

  const currentStep = steps[step - 1];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold">Emitir Nota Fiscal</h1><p className="text-sm text-subtle">NF-e / NFC-e com simulador de rejeicao integrado</p></div>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-4 mb-4">
          {steps.map((s, i) => (
            <div key={s.id} className="flex flex-col items-center">
              <div className={`grid h-10 w-10 place-items-center rounded-full ${i + 1 < step ? "bg-emerald-500 text-white" : i + 1 === step ? "bg-lime text-ink" : "bg-muted text-subtle"}`}>
                {i + 1 < step ? <CheckCircle2 className="h-5 w-5" /> : <span className="font-bold">{s.id}</span>}
              </div>
              <span className="text-xs text-center mt-1">{s.title}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold mb-3">{currentStep.title}</h3>
        <p className="text-sm text-subtle mb-4">{currentStep.desc}</p>

        {step === 1 && (
          <div className="grid gap-3 md:grid-cols-3">
            <Input label="Emitente" placeholder="Empresa" />
            <Input label="Destinatario" placeholder="Cliente" />
            <Input label="Natureza operacao" placeholder="Venda / Devolucao" />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4 p-3 bg-muted/50 rounded-xl"><Input placeholder="Produto" /><Input placeholder="NCM" /><Input placeholder="CST" /><Input placeholder="CFOP" /></div>
            <div className="grid gap-3 md:grid-cols-4"><Input type="number" placeholder="Qtde" /><Input type="number" step="0.01" placeholder="Vl. unit" /><Input type="number" step="0.01" placeholder="Vl. total" /><Button variant="lime">Adicionar</Button></div>
            <div className="text-sm text-subtle">Itens: 0 | Total: R$ 0,00</div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-3 md:grid-cols-4">
            <Input label="BC ICMS" type="number" step="0.01" placeholder="0,00" />
            <Input label="ICMS" type="number" step="0.01" placeholder="0,00" />
            <Input label="IPI" type="number" step="0.01" placeholder="0,00" />
            <Input label="PIS/COFINS" type="number" step="0.01" placeholder="0,00" />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <Button variant="lime" onClick={simulateRejection}><Zap className="h-4 w-4" /> Simular rejeicao</Button>
            {rejectionRisk && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div><AlertTriangle className="h-5 w-5 inline mr-2 text-yellow-500" /><span className="font-bold">Chance de rejeicao: {rejectionRisk.chance}%</span></div>
                  <Badge variant={rejectionRisk.criticalBlocking ? "destructive" : "warning"}>
                    {rejectionRisk.criticalBlocking ? "BLOQUEADO" : "Pode emitir"}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {rejectionRisk.risks.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-line">
                      <div className="flex items-center gap-3">
                        <Badge variant={r.severity === "CRITICAL" ? "destructive" : "warning"}>{r.severity}</Badge>
                        <span className="font-medium">{r.label}</span>
                        <span className="text-sm text-subtle">{r.description}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-subtle">{r.autoFix ? "? Auto-fix" : "Manual"}</span>
                        {r.autoFix && <Button variant="lime" size="sm">{r.action}</Button>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <Card className="p-4 bg-emerald-50 border-emerald-200"><CheckCircle2 className="h-5 w-5 inline mr-2 text-emerald-500" /><span className="font-bold">Nota pronta para emissao</span></Card>
            <div className="flex gap-2"><Button variant="outline">Salvar rascunho</Button><Button variant="lime" onClick={() => notify({ title: "Nota emitida (mock)", description: "NF-e autorizada com sucesso" })}><Send className="h-4 w-4" /> Emitir nota</Button></div>
          </div>
        )}

        <div className="flex justify-between mt-4 pt-4 border-t border-line">
          <Button variant="outline" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>Voltar</Button>
          <Button variant={step === 5 ? "lime" : "default"} onClick={() => setStep(s => Math.min(5, s + 1))} disabled={step === 4 && rejectionRisk?.criticalBlocking}>
            {step === 5 ? "Emitir" : "Proximo"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

