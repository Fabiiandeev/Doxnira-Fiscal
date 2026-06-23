"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { notify } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getCompanyId, setCompanyId } from "@/lib/api";
import {
  deleteCompany,
  listCompanies,
  type Company,
} from "@/lib/services/company-service";
import { maskCnpj } from "@/lib/utils";

export function RemoveCompanyDialog({
  company,
  onRemoved,
}: {
  company: Pick<Company, "id" | "legalName" | "tradeName" | "cnpj">;
  onRemoved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteCompany(company.id),
    onSuccess: async (result) => {
      if (getCompanyId() === company.id) {
        try {
          const companies = await listCompanies();
          if (companies.data[0]) setCompanyId(companies.data[0].id);
        } catch {
          // A lista será recarregada pela invalidação abaixo.
        }
      }
      setOpen(false);
      notify({ title: result.message });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["sync-readiness"] });
      onRemoved?.();
    },
    onError: (error) =>
      notify({
        title: "Empresa não removida",
        description: error.message,
        tone: "error",
      }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger" size="sm">
          <Trash2 className="h-4 w-4" />
          Remover
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Remover empresa</DialogTitle>
        <DialogDescription>
          Essa ação removerá a empresa da sua lista. Certifique-se de manter a empresa correta
          para o certificado digital.
        </DialogDescription>
        <div className="mt-5 rounded-2xl bg-muted p-4">
          <p className="text-sm font-extrabold">{company.tradeName || company.legalName}</p>
          <p className="mt-1 text-xs text-subtle">{maskCnpj(company.cnpj)}</p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
            {remove.isPending ? "Removendo..." : "Confirmar remoção"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
