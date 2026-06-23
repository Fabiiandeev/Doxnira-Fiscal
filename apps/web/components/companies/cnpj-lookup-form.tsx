"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/components/toast-viewport";
import {
  lookupCnpj,
  type CnpjLookupResponse,
} from "@/lib/services/cnpj-service";
import { maskCnpj, normalizeCnpj } from "@/lib/utils";

interface CnpjLookupFormProps {
  onDataLoaded?: (data: CnpjLookupResponse) => void;
  onError?: (error: string) => void;
}

export function CnpjLookupForm({ onDataLoaded, onError }: CnpjLookupFormProps) {
  const [cnpj, setCnpj] = useState("");
  const [data, setData] = useState<CnpjLookupResponse | null>(null);

  const lookup = useMutation({
    mutationFn: async (value: string) => {
      function sanitizeCnpjInput(input: string) {
        const s = String(input || "").trim();
        if (s.includes(":")) {
          const left = s.split(":")[0];
          const leftDigits = normalizeCnpj(left);
          if (leftDigits.length === 14) return leftDigits;
        }
        const found = s.match(/(\d{14})/);
        if (found) return found[1];
        const digits = normalizeCnpj(s);
        if (digits.length === 14) return digits;
        if (digits.length > 14) return digits.slice(0, 14);
        return digits;
      }

      const sanitized = sanitizeCnpjInput(value);
      if (sanitized.length !== 14) {
        throw new Error("CNPJ deve conter 14 dígitos");
      }
      return lookupCnpj(sanitized);
    },
    onSuccess: (result) => {
      setData(result);
      notify({
        title: "CNPJ encontrado",
        description: `${result.empresa.razaoSocial} - ${result.empresa.uf}`,
      });
      onDataLoaded?.(result);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "CNPJ não encontrado";
      notify({ title: "Erro", description: message, tone: "error" });
      onError?.(message);
    },
  });

  function handleSearch() {
    if (!cnpj.trim()) {
      notify({ title: "CNPJ obrigatório", tone: "error" });
      return;
    }
    lookup.mutate(cnpj);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSearch();
  }

  function handleClear() {
    setCnpj("");
    setData(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Input
          placeholder="Digite o CNPJ (com ou sem formatação)"
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={lookup.isPending}
          maxLength={18}
          className="flex-1"
        />
        <Button
          onClick={handleSearch}
          disabled={lookup.isPending || !cnpj.trim()}
          size="sm"
        >
          {lookup.isPending ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar dados
        </Button>
        {data && (
          <Button onClick={handleClear} variant="outline" size="sm">
            Limpar
          </Button>
        )}
      </div>

      {data && (
        <>
          <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
              <p className="text-sm font-extrabold">
                Dados encontrados automaticamente
              </p>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-[9px] font-extrabold uppercase text-subtle">Razão Social</p>
                <p className="mt-1 font-semibold">{data.empresa.razaoSocial || "—"}</p>
              </div>
              <div>
                <p className="text-[9px] font-extrabold uppercase text-subtle">Nome Fantasia</p>
                <p className="mt-1 font-semibold">{data.empresa.nomeFantasia || "—"}</p>
              </div>
              <div>
                <p className="text-[9px] font-extrabold uppercase text-subtle">CNPJ</p>
                <p className="mt-1 font-semibold">{maskCnpj(data.empresa.cnpj)}</p>
              </div>
              <div>
                <p className="text-[9px] font-extrabold uppercase text-subtle">Localização</p>
                <p className="mt-1 font-semibold">{data.empresa.cidade || "—"} / {data.empresa.uf || "—"}</p>
              </div>
              <div>
                <p className="text-[9px] font-extrabold uppercase text-subtle">CNAE Principal</p>
                <p className="mt-1 font-semibold">{data.empresa.cnaePrincipal.codigoFormatado || "—"}</p>
              </div>
              <div>
                <p className="text-[9px] font-extrabold uppercase text-subtle">Inscrição Estadual</p>
                <p className="mt-1 font-semibold">{data.inscricaoEstadual.numeroFormatado || "Não encontrada"}</p>
              </div>
              <div>
                <p className="text-[9px] font-extrabold uppercase text-subtle">IE somente números</p>
                <p className="mt-1 font-semibold">{data.inscricaoEstadual.numero || "—"}</p>
              </div>
              <div>
                <p className="text-[9px] font-extrabold uppercase text-subtle">Ambiente fiscal</p>
                <p className="mt-1 font-semibold">
                  {data.fiscal.ambiente === "PRODUCAO" ? "PRODUÇÃO" : "HOMOLOGAÇÃO"}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-extrabold uppercase text-subtle">Regime de apuração</p>
                <p className="mt-1 font-semibold">{data.fiscal.regimeApuracao}</p>
              </div>
              <div>
                <p className="text-[9px] font-extrabold uppercase text-subtle">Regime tributário</p>
                <p className="mt-1 font-semibold">{data.fiscal.regimeTributario}</p>
              </div>
              <div>
                <p className="text-[9px] font-extrabold uppercase text-subtle">PIS/COFINS</p>
                <p className="mt-1 font-semibold">{data.fiscal.pisCofins}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[9px] font-extrabold uppercase text-subtle">Atividade</p>
                <p className="mt-1 text-[11px]">{data.empresa.cnaePrincipal.descricao || "—"}</p>
              </div>
              <div>
                <p className="text-[9px] font-extrabold uppercase text-subtle">Status da IE</p>
                <p className="mt-1 font-semibold">{data.inscricaoEstadual.situacao}</p>
              </div>
              <div>
                <p className="text-[9px] font-extrabold uppercase text-subtle">Contribuinte ICMS</p>
                <p className="mt-1 font-semibold">{data.fiscal.contribuinteICMS}</p>
              </div>
            </div>
          </div>

          {data.inscricaoEstadual.numero &&
            data.inscricaoEstadual.situacao === "PENDENTE_VALIDACAO_SEFAZ" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="text-xs font-extrabold text-amber-900">
                    Inscrição Estadual encontrada, mas ainda precisa ser validada na SEFAZ/SINTEGRA para liberar o fechamento fiscal.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() =>
                      notify({
                        title: "Validação pendente",
                        description:
                          "A validação oficial deve ser concluída na SEFAZ/SINTEGRA.",
                      })
                    }
                  >
                    Validar IE
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
