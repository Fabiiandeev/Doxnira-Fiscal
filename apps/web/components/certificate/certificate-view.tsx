"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  FileKey2,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getCompanyId } from "@/lib/api";
import {
  deleteCertificate,
  getCertificate,
  uploadCertificate,
} from "@/lib/services/certificate-service";
import { formatDate, maskCnpj } from "@/lib/utils";

export function CertificateView() {
  const companyId = getCompanyId();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const certificate = useQuery({
    queryKey: ["certificate", companyId],
    queryFn: () => getCertificate(companyId!),
    enabled: Boolean(companyId),
  });
  const upload = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("Selecione um arquivo PFX ou P12.");
      return uploadCertificate(companyId!, file, password);
    },
    onSuccess: () => {
      notify({ title: "Certificado validado", description: "A1 criptografado e compatível com a empresa." });
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["certificate"] });
      queryClient.invalidateQueries({ queryKey: ["sync-readiness"] });
    },
    onError: (error) => notify({ title: "Upload não concluído", description: error.message, tone: "error" }),
  });
  const remove = useMutation({
    mutationFn: () => deleteCertificate(companyId!),
    onSuccess: () => {
      notify({ title: "Certificado removido", description: "A sincronização foi bloqueada novamente." });
      queryClient.invalidateQueries({ queryKey: ["certificate"] });
      queryClient.invalidateQueries({ queryKey: ["sync-readiness"] });
    },
    onError: (error) => notify({ title: "Exclusão não concluída", description: error.message, tone: "error" }),
  });

  const data = certificate.data?.certificate;
  const uploader = (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="lime"><Upload className="h-4 w-4" />{data ? "Substituir certificado" : "Enviar certificado"}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Enviar certificado A1</DialogTitle>
        <DialogDescription>O arquivo será validado em memória e armazenado com criptografia.</DialogDescription>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-[11px] font-extrabold">Arquivo PFX ou P12</span>
            <Input ref={fileRef} type="file" accept=".pfx,.p12" className="h-12 p-3" />
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-extrabold">Senha do certificado</span>
            <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Senha protegida" />
          </label>
        </div>
        <div className="mt-7 flex justify-end gap-2">
          <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
          <Button variant="lime" onClick={() => upload.mutate()} disabled={upload.isPending}>
            {upload.isPending ? "Validando..." : "Criptografar e salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <PageHeader
        eyebrow="Identidade eletrônica"
        title="Certificado digital"
        description="Credencial A1 protegida e preparada para autenticação fiscal futura."
        icon={FileKey2}
        action={<div className="flex gap-2">{data && <Button variant="outline" onClick={() => window.confirm("Excluir o certificado atual?") && remove.mutate()}><Trash2 className="h-4 w-4" />Excluir</Button>}{uploader}</div>}
      />

      {!data ? (
        <Card className="grid min-h-[420px] place-items-center p-8 text-center">
          <div className="max-w-md">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-pastel-yellow"><FileKey2 className="h-7 w-7 text-amber-700" /></div>
            <h2 className="mt-6 text-2xl font-extrabold">Aguardando certificado</h2>
            <p className="mt-3 text-sm leading-6 text-subtle">Cadastre um A1 válido. A sincronização real permanece condicionada às flags de ambiente.</p>
            <div className="mt-6 flex justify-center">{uploader}</div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_1.85fr]">
          <Card className="overflow-hidden">
            <div className="bg-ink p-6 text-white">
              <div className="flex items-start justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-lime text-ink"><FileKey2 className="h-5 w-5" /></div>
                <Badge className={data.valid ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-200"}>{data.valid ? "Válido" : "Inválido"}</Badge>
              </div>
              <p className="mt-8 text-[10px] font-extrabold uppercase tracking-wider text-white/45">Certificado digital A1</p>
              <h2 className="mt-2 text-xl font-extrabold">Certificado validado</h2>
              <p className="mt-2 text-[11px] leading-5 text-white/50">Arquivo e senha permanecem criptografados e nunca são retornados pela API.</p>
            </div>
            <div className="grid gap-px bg-line sm:grid-cols-3">
              <Metric icon={CalendarClock} label="Validade" value={data.validUntil ? formatDate(data.validUntil) : "—"} />
              <Metric icon={ShieldCheck} label="Restante" value={`${data.daysRemaining ?? 0} dias`} />
              <Metric icon={LockKeyhole} label="Titular" value={data.holderCnpj ? maskCnpj(data.holderCnpj) : "—"} />
            </div>
          </Card>
          <Card className="p-5 md:p-6">
            <div className="flex items-start justify-between"><div><h2 className="text-[15px] font-extrabold">Informações do certificado</h2><p className="mt-1 text-[11px] text-subtle">Somente metadados públicos são exibidos.</p></div><Badge variant="success">Compatível</Badge></div>
            <dl className="mt-6 grid gap-x-8 md:grid-cols-2">
              <Row label="Titular" value={data.subject || "—"} />
              <Row label="CNPJ" value={data.holderCnpj ? maskCnpj(data.holderCnpj) : "—"} />
              <Row label="Emissor" value={data.issuer || "—"} />
              <Row label="Número de série" value={data.serialNumber || "—"} />
              <Row label="Início da validade" value={data.validFrom ? formatDate(data.validFrom) : "—"} />
              <Row label="Fim da validade" value={data.validUntil ? formatDate(data.validUntil) : "—"} />
            </dl>
            {(data.daysRemaining ?? 999) <= 30 && <div className="mt-5 flex items-start gap-3 rounded-2xl bg-pastel-yellow p-4"><AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" /><p className="text-[10px] text-amber-900">O certificado está próximo do vencimento.</p></div>}
          </Card>
        </div>
      )}
    </>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof CalendarClock; label: string; value: string }) {
  return <div className="bg-white p-4"><Icon className="mb-3 h-4 w-4 text-subtle" /><p className="text-[9px] font-bold text-subtle">{label}</p><p className="mt-1 text-[10px] font-extrabold">{value}</p></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="border-t border-line py-3 first:border-0"><dt className="text-[9px] font-bold uppercase tracking-wider text-subtle">{label}</dt><dd className="mt-1 break-words text-[11px] font-extrabold">{value}</dd></div>;
}
