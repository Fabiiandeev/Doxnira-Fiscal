"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileKey2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { RemoveCompanyDialog } from "@/components/companies/remove-company-dialog";
import { useConfirmDialog } from "@/components/providers/confirm-dialog-provider";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import {
  deleteCertificate,
  getCertificate,
  uploadCertificate,
} from "@/lib/services/certificate-service";
import type { Company } from "@/lib/services/company-service";
import { formatDate } from "@/lib/utils";

export function CompanyCertificateSection({ company }: { company: Company }) {
  const queryClient = useQueryClient();
  const { confirm } = useConfirmDialog();
  const fileRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [mismatch, setMismatch] = useState<{
    companyCnpjMasked: string;
    certificateCnpjMasked: string;
  } | null>(null);
  const certificate = useQuery({
    queryKey: ["certificate", company.id],
    queryFn: () => getCertificate(company.id),
  });
  const upload = useMutation({
    mutationFn: () => {
      const file = fileRef.current?.files?.[0];
      if (!file || !/\.(pfx|p12)$/i.test(file.name)) {
        throw new Error("Envie um certificado digital A1 .pfx ou .p12.");
      }
      if (!password) throw new Error("Informe a senha do certificado digital.");
      return uploadCertificate(company.id, file, password);
    },
    onSuccess: () => {
      setPassword("");
      setMismatch(null);
      if (fileRef.current) fileRef.current.value = "";
      notify({ title: "Certificado validado e salvo." });
      queryClient.invalidateQueries({ queryKey: ["certificate", company.id] });
      queryClient.invalidateQueries({ queryKey: ["sync-readiness"] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "CERTIFICATE_CNPJ_MISMATCH") {
        const details = error.details as Partial<{
          companyCnpjMasked: string;
          certificateCnpjMasked: string;
        }>;
        if (details.companyCnpjMasked && details.certificateCnpjMasked) {
          setMismatch({
            companyCnpjMasked: details.companyCnpjMasked,
            certificateCnpjMasked: details.certificateCnpjMasked,
          });
        }
      }
      notify({ title: "Certificado não enviado", description: error.message, tone: "error" });
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteCertificate(company.id),
    onSuccess: () => {
      notify({ title: "Certificado removido." });
      queryClient.invalidateQueries({ queryKey: ["certificate", company.id] });
      queryClient.invalidateQueries({ queryKey: ["sync-readiness"] });
    },
    onError: (error) =>
      notify({ title: "Certificado não removido", description: error.message, tone: "error" }),
  });

  const data = certificate.data?.certificate;
  async function confirmRemoveCertificate() {
    const confirmed = await confirm({
      title: "Remover certificado",
      description: "Remover o certificado atual bloqueará emissão e sincronização fiscal real até novo envio.",
      confirmLabel: "Remover",
      tone: "danger",
    });
    if (confirmed) remove.mutate();
  }

  return (
    <Card className="mb-4 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-extrabold">
            <FileKey2 className="h-4 w-4" />
            3. Certificado Digital A1
          </h2>
          <p className="mt-1 text-xs text-subtle">
            Envie ou substitua o certificado vinculado a esta empresa.
          </p>
        </div>
        <Badge variant={data?.valid ? "success" : "neutral"}>
          {data?.valid ? "Válido" : data ? "Inválido" : "Não cadastrado"}
        </Badge>
      </div>

      {data && (
        <div className="mt-5 grid gap-3 rounded-2xl bg-muted p-4 text-xs sm:grid-cols-2">
          <div>
            <p className="text-subtle">Status</p>
            <p className="mt-1 font-extrabold">{data.status}</p>
          </div>
          <div>
            <p className="text-subtle">Validade</p>
            <p className="mt-1 font-extrabold">
              {data.validUntil ? formatDate(data.validUntil) : "Não informada"}
            </p>
          </div>
        </div>
      )}

      {mismatch && (
        <div className="mt-5 rounded-2xl bg-red-50 p-4 text-xs text-red-700">
          <p className="font-extrabold">O certificado pertence a outro CNPJ.</p>
          <p className="mt-2">CNPJ da empresa: {mismatch.companyCnpjMasked}</p>
          <p>CNPJ do certificado: {mismatch.certificateCnpjMasked}</p>
          <p className="mt-2">Corrija o CNPJ da empresa nesta tela ou envie o certificado correto.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById("company-cnpj")?.focus()}
            >
              Editar CNPJ
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Trocar certificado
            </Button>
            <RemoveCompanyDialog company={company} />
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label>
          <span className="mb-2 block text-[11px] font-extrabold">
            Arquivo do certificado (.pfx ou .p12)
          </span>
          <Input ref={fileRef} type="file" accept=".pfx,.p12" className="h-12 p-3" />
        </label>
        <label>
          <span className="mb-2 block text-[11px] font-extrabold">
            Senha do certificado
          </span>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Senha protegida"
          />
        </label>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {data && (
          <Button
            variant="danger"
            onClick={confirmRemoveCertificate}
            disabled={remove.isPending}
          >
            <Trash2 className="h-4 w-4" />
            Remover certificado
          </Button>
        )}
        <Button variant="lime" onClick={() => upload.mutate()} disabled={upload.isPending}>
          <Upload className="h-4 w-4" />
          {upload.isPending ? "Enviando..." : data ? "Substituir certificado" : "Enviar certificado"}
        </Button>
      </div>
    </Card>
  );
}
