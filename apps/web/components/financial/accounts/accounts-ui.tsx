"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft, CircleDollarSign, Pencil, Plus, Power, PowerOff, RefreshCw, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { notify } from "@/components/toast-viewport";
import { ApiError, getSessionUser } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  useActivateFinancialAccount,
  useCreateFinancialAccount,
  useDeactivateFinancialAccount,
  useFinancialAccount,
  useFinancialAccounts,
  useUpdateFinancialAccount,
} from "@/lib/services/financial-accounts/financial-account-hooks";
import { validateFinancialAccount, type FinancialAccountErrors } from "@/lib/services/financial-accounts/financial-account-schemas";
import type { FinancialAccount, FinancialAccountInput, FinancialAccountType } from "@/lib/services/financial-accounts/financial-account-types";
import { financialAccountTypeLabels } from "@/lib/services/financial-accounts/financial-account-types";

const date = (value?: string | null) => (value ? new Intl.DateTimeFormat("pt-BR").format(new Date(value)) : "—");
const money = (value?: string | null) => formatCurrency(Number(value || 0));
const selectClass = "h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ink/10";

function Loading() {
  return (
    <div className="grid gap-3 md:grid-cols-3" aria-label="Carregando">
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i} className="h-24 animate-pulse bg-muted" />
      ))}
    </div>
  );
}
function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <Card className="p-8 text-center">
      <p className="text-sm text-red-700">{message}</p>
      <Button className="mt-4" variant="outline" onClick={retry}>
        <RefreshCw className="h-4 w-4" />
        Tentar novamente
      </Button>
    </Card>
  );
}

export function FinancialAccountsList() {
  const router = useRouter();
  const query = useFinancialAccounts();
  const activate = useActivateFinancialAccount();
  const deactivate = useDeactivateFinancialAccount();
  const canWrite = getSessionUser()?.role !== "VIEWER";
  const records = useMemo(() => query.data?.data || [], [query.data]);
  const totalBalance = useMemo(
    () => records.filter((x) => x.active).reduce((sum, x) => sum + Number(x.initialBalance || 0), 0),
    [records],
  );
  const activeCount = useMemo(() => records.filter((x) => x.active).length, [records]);

  const toggle = (account: FinancialAccount) => {
    const action = account.active ? deactivate : activate;
    action.mutate(
      { id: account.id },
      {
        onSuccess: () => notify({ title: account.active ? "Conta desativada" : "Conta ativada", tone: "success" }),
        onError: (e: Error) =>
          notify({ title: "Operação bloqueada", description: e.message, tone: "error" }),
      },
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Contas financeiras"
        description="Caixas, contas correntes e carteiras digitais usadas nas baixas e no fluxo de caixa."
        icon={CircleDollarSign}
        action={
          canWrite ? (
            <Button variant="lime" asChild>
              <Link href="/financeiro/contas-financeiras/nova">
                <Plus className="h-4 w-4" />
                Nova conta
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-subtle">Saldo inicial total</p>
          <p className="mt-2 text-lg font-extrabold">{money(String(totalBalance))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-subtle">Contas ativas</p>
          <p className="mt-2 text-lg font-extrabold">{activeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-subtle">Total cadastrado</p>
          <p className="mt-2 text-lg font-extrabold">{records.length}</p>
        </Card>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState message={query.error.message} retry={() => query.refetch()} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-muted text-subtle">
              <tr>
                {["Nome", "Tipo", "Instituição", "Saldo inicial", "Desde", "Status", "Ações"].map((x) => (
                  <th className="p-3" key={x}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((account) => (
                <tr className="border-t" key={account.id}>
                  <td className="p-3 font-bold">{account.name}</td>
                  <td className="p-3">{financialAccountTypeLabels[account.type] || account.type}</td>
                  <td className="p-3">{account.bank || "—"}</td>
                  <td className="p-3">{money(account.initialBalance)}</td>
                  <td className="p-3">{date(account.initialBalanceDate)}</td>
                  <td className="p-3">
                    <Badge variant={account.active ? "success" : "neutral"}>
                      {account.active ? "Ativa" : "Inativa"}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/financeiro/contas-financeiras/${account.id}/editar`)}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                      {canWrite && (
                        <Button
                          size="sm"
                          variant={account.active ? "outline" : "lime"}
                          disabled={activate.isPending || deactivate.isPending}
                          onClick={() => toggle(account)}
                        >
                          {account.active ? (
                            <>
                              <PowerOff className="h-4 w-4" />
                              Desativar
                            </>
                          ) : (
                            <>
                              <Power className="h-4 w-4" />
                              Ativar
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!records.length && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-subtle">
                    Nenhuma conta financeira cadastrada. Use “Nova conta” para cadastrar Caixa Homologação.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

const empty: FinancialAccountInput = {
  name: "",
  type: "CASH",
  bank: "",
  branch: "",
  maskedAccount: "",
  initialBalance: "0",
  initialBalanceDate: new Date().toISOString().slice(0, 10),
  active: true,
};

export function FinancialAccountForm({ accountId }: { accountId?: string }) {
  const router = useRouter();
  const detail = useFinancialAccount(accountId || "");
  const create = useCreateFinancialAccount();
  const update = useUpdateFinancialAccount();
  const [form, setForm] = useState<FinancialAccountInput>(empty);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<FinancialAccountErrors>({});
  const saveAndOpen = useRef(false);
  const setSaveAndOpen = (value: boolean) => {
    saveAndOpen.current = value;
  };
  const canWrite = getSessionUser()?.role !== "VIEWER";

  if (accountId && detail.data && !loaded) {
    const x = detail.data;
    setForm({
      name: x.name || "",
      type: (x.type as FinancialAccountType) || "CASH",
      bank: x.bank || "",
      branch: x.branch || "",
      maskedAccount: x.maskedAccount || "",
      initialBalance: String(x.initialBalance || "0"),
      initialBalanceDate: x.initialBalanceDate ? new Date(x.initialBalanceDate).toISOString().slice(0, 10) : "",
      active: x.active,
    });
    setLoaded(true);
  }

  const blocked = Boolean(accountId && !canWrite);
  const set = <K extends keyof FinancialAccountInput>(key: K, value: FinancialAccountInput[K]) =>
    setForm((v) => ({ ...v, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = validateFinancialAccount(form);
    setErrors(next);
    if (Object.keys(next).length) return;
    const callbacks = {
      onSuccess: (result: unknown) => {
        const id = accountId || (result as FinancialAccount)?.id;
        notify({ title: accountId ? "Conta atualizada" : "Conta criada", tone: "success" });
        router.push(
          (accountId || saveAndOpen.current) && id ? `/financeiro/contas-financeiras` : "/financeiro/contas-financeiras",
        );
      },
      onError: (error: Error) => notify({ title: "Não foi possível salvar", description: error.message, tone: "error" }),
    };
    if (accountId) update.mutate({ id: accountId, input: form }, callbacks);
    else create.mutate(form, callbacks);
  };

  if (accountId && detail.isLoading) return <Loading />;
  if (accountId && detail.isError)
    return (
      <ErrorState
        message={detail.error instanceof ApiError && detail.error.status === 404 ? "Conta financeira não encontrada." : detail.error.message}
        retry={() => detail.refetch()}
      />
    );

  return (
    <form onSubmit={submit}>
      <PageHeader
        eyebrow="Contas financeiras"
        title={accountId ? "Editar conta" : "Nova conta"}
        description="Caixa não exige dados bancários. Use Caixa Homologação para homologação."
        icon={Wallet}
      />
      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <Input
          label="Nome"
          value={form.name}
          disabled={blocked}
          error={errors.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <label className="text-sm font-medium">
          Tipo
          <select
            className={`${selectClass} mt-1 font-normal`}
            value={form.type}
            disabled={blocked}
            onChange={(e) => set("type", e.target.value as FinancialAccountType)}
          >
            {(Object.keys(financialAccountTypeLabels) as FinancialAccountType[]).map((value) => (
              <option key={value} value={value}>
                {financialAccountTypeLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Instituição/Banco"
          value={form.bank || ""}
          disabled={blocked}
          placeholder="Opcional para caixa"
          onChange={(e) => set("bank", e.target.value)}
        />
        <Input
          label="Agência"
          value={form.branch || ""}
          disabled={blocked}
          placeholder="Opcional para caixa"
          onChange={(e) => set("branch", e.target.value)}
        />
        <Input
          label="Conta (mascarada)"
          value={form.maskedAccount || ""}
          disabled={blocked}
          placeholder="Opcional para caixa"
          onChange={(e) => set("maskedAccount", e.target.value)}
        />
        <Input
          label="Saldo inicial (R$)"
          inputMode="decimal"
          value={form.initialBalance}
          disabled={blocked}
          error={errors.initialBalance}
          onChange={(e) => set("initialBalance", e.target.value.replace(",", "."))}
        />
        <Input
          label="Data do saldo inicial"
          type="date"
          value={form.initialBalanceDate}
          disabled={blocked}
          error={errors.initialBalanceDate}
          onChange={(e) => set("initialBalanceDate", e.target.value)}
        />
        <label className="flex items-center gap-2 md:col-span-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.active}
            disabled={blocked}
            onChange={(e) => set("active", e.target.checked)}
          />
          Conta ativa (disponível em baixas)
        </label>
      </Card>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" type="button" onClick={() => router.push("/financeiro/contas-financeiras")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        {canWrite && (
          <>
            <Button
              variant="outline"
              type="submit"
              disabled={create.isPending || update.isPending}
              onClick={() => setSaveAndOpen(false)}
            >
              Salvar
            </Button>
            <Button
              variant="lime"
              type="submit"
              disabled={create.isPending || update.isPending}
              onClick={() => setSaveAndOpen(true)}
            >
              {create.isPending || update.isPending ? "Salvando…" : "Salvar e abrir"}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}

export function ReopenDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
  pending?: boolean;
}) {
  const [reason, setReason] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const close = (value: boolean) => {
    onOpenChange(value);
    if (!value) setReason("");
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent onOpenAutoFocus={() => setTimeout(() => input.current?.focus(), 0)}>
        <DialogTitle>Reabrir conta</DialogTitle>
        <DialogDescription>
          A conta será retornada ao status de aberta. Justificativa é obrigatória (mínimo 10 caracteres).
        </DialogDescription>
        <div className="mt-5 grid gap-4">
          <Input
            ref={input}
            label="Justificativa"
            value={reason}
            error={reason && reason.trim().length < 10 ? "Informe ao menos 10 caracteres." : undefined}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => close(false)}>
              Voltar
            </Button>
            <Button
              variant="lime"
              disabled={reason.trim().length < 10 || Boolean(pending)}
              onClick={() => onSubmit(reason.trim())}
            >
              {pending ? "Reabrindo…" : "Confirmar reabertura"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
