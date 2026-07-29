"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Plus, Route, Truck } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { notify } from "@/components/toast-viewport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  mdfeOperationalService,
  type Driver,
  type FiscalEstablishment,
  type FleetVehicle,
  type MdfeOperationalSetting,
} from "@/lib/services/mdfe-operational-service";

const establishmentEmpty = {
  code: "", legalName: "", tradeName: "", taxId: "", stateRegistration: "",
  cityCode: "", city: "", state: "",
};
const vehicleEmpty = { plate: "", plateState: "", renavam: "", rntrc: "" };

export function MdfeOperationalSettingsView() {
  const [establishments, setEstablishments] = useState<FiscalEstablishment[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [settings, setSettings] = useState<MdfeOperationalSetting[]>([]);
  const [scope, setScope] = useState("global");
  const [establishmentForm, setEstablishmentForm] = useState(establishmentEmpty);
  const [vehicleForm, setVehicleForm] = useState(vehicleEmpty);
  const [defaults, setDefaults] = useState({
    defaultVehicleId: "", defaultDriverId: "", defaultSeries: "1",
    environment: "", rntrc: "", quickModeEnabled: true,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [establishmentResponse, driverResponse, vehicleResponse, settingResponse] = await Promise.all([
        mdfeOperationalService.establishments(),
        mdfeOperationalService.drivers(),
        mdfeOperationalService.vehicles(),
        mdfeOperationalService.settings(),
      ]);
      setEstablishments(establishmentResponse.data);
      setDrivers(driverResponse.data);
      setVehicles(vehicleResponse.data);
      setSettings(settingResponse.data);
    } catch (error) {
      notify({ title: "Configuração MDF-e não carregada", description: (error as Error).message, tone: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedSetting = useMemo(
    () => settings.find((item) => (item.establishmentId || "global") === scope),
    [scope, settings],
  );

  useEffect(() => {
    setDefaults({
      defaultVehicleId: selectedSetting?.defaultVehicleId || "",
      defaultDriverId: selectedSetting?.defaultDriverId || "",
      defaultSeries: selectedSetting?.defaultSeries || "1",
      environment: selectedSetting?.environment || "",
      rntrc: selectedSetting?.rntrc || "",
      quickModeEnabled: selectedSetting?.quickModeEnabled ?? true,
    });
  }, [selectedSetting, scope]);

  async function createEstablishment() {
    try {
      await mdfeOperationalService.createEstablishment({
        ...establishmentForm,
        isHeadquarters: establishments.length === 0,
      });
      setEstablishmentForm(establishmentEmpty);
      await load();
      notify({ title: "Estabelecimento cadastrado", tone: "success" });
    } catch (error) {
      notify({ title: "Estabelecimento não salvo", description: (error as Error).message, tone: "error" });
    }
  }

  async function createVehicle() {
    try {
      await mdfeOperationalService.createVehicle(vehicleForm);
      setVehicleForm(vehicleEmpty);
      await load();
      notify({ title: "Veículo cadastrado", tone: "success" });
    } catch (error) {
      notify({ title: "Veículo não salvo", description: (error as Error).message, tone: "error" });
    }
  }

  async function saveDefaults() {
    try {
      await mdfeOperationalService.saveSettings({
        establishmentId: scope === "global" ? null : scope,
        defaultVehicleId: defaults.defaultVehicleId || null,
        defaultDriverId: defaults.defaultDriverId || null,
        defaultSeries: defaults.defaultSeries,
        environment: defaults.environment || null,
        rntrc: defaults.rntrc || null,
        quickModeEnabled: defaults.quickModeEnabled,
      });
      await load();
      notify({ title: "Padrões MDF-e salvos", tone: "success" });
    } catch (error) {
      notify({ title: "Padrões não salvos", description: (error as Error).message, tone: "error" });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Configurações"
        title="Operação MDF-e"
        description="Estabelecimentos, frota e padrões aplicados automaticamente ao modo rápido."
        icon={Route}
      />
      {loading && <Card className="mb-5 p-6 text-sm text-subtle">Carregando configuração…</Card>}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2"><Building2 className="h-5 w-5" /><h2 className="font-extrabold">Estabelecimentos e filiais</h2></div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Código" value={establishmentForm.code} onChange={(e) => setEstablishmentForm({ ...establishmentForm, code: e.target.value })} />
            <Input label="CNPJ / identificação fiscal" value={establishmentForm.taxId} onChange={(e) => setEstablishmentForm({ ...establishmentForm, taxId: e.target.value })} />
            <Input label="Razão social" value={establishmentForm.legalName} onChange={(e) => setEstablishmentForm({ ...establishmentForm, legalName: e.target.value })} />
            <Input label="Nome fantasia" value={establishmentForm.tradeName} onChange={(e) => setEstablishmentForm({ ...establishmentForm, tradeName: e.target.value })} />
            <Input label="Inscrição estadual" value={establishmentForm.stateRegistration} onChange={(e) => setEstablishmentForm({ ...establishmentForm, stateRegistration: e.target.value })} />
            <Input label="Código IBGE" value={establishmentForm.cityCode} onChange={(e) => setEstablishmentForm({ ...establishmentForm, cityCode: e.target.value })} />
            <Input label="Município" value={establishmentForm.city} onChange={(e) => setEstablishmentForm({ ...establishmentForm, city: e.target.value })} />
            <Input label="UF" maxLength={2} value={establishmentForm.state} onChange={(e) => setEstablishmentForm({ ...establishmentForm, state: e.target.value.toUpperCase() })} />
          </div>
          <Button className="mt-4" variant="lime" disabled={!establishmentForm.code || !establishmentForm.legalName || !establishmentForm.taxId} onClick={createEstablishment}>
            <Plus className="h-4 w-4" />Adicionar estabelecimento
          </Button>
          <div className="mt-5 space-y-2">
            {establishments.map((item) => (
              <div className="flex items-center justify-between rounded-xl border p-3 text-sm" key={item.id}>
                <div><b>{item.code} · {item.tradeName || item.legalName}</b><p className="text-xs text-subtle">{item.taxId} · {item.city || "Município pendente"}/{item.state || "--"}</p></div>
                <Badge>{item.isHeadquarters ? "MATRIZ" : "FILIAL"}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2"><Truck className="h-5 w-5" /><h2 className="font-extrabold">Frota MDF-e</h2></div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Placa" value={vehicleForm.plate} onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value.toUpperCase() })} />
            <Input label="UF da placa" maxLength={2} value={vehicleForm.plateState} onChange={(e) => setVehicleForm({ ...vehicleForm, plateState: e.target.value.toUpperCase() })} />
            <Input label="RENAVAM" value={vehicleForm.renavam} onChange={(e) => setVehicleForm({ ...vehicleForm, renavam: e.target.value })} />
            <Input label="RNTRC" value={vehicleForm.rntrc} onChange={(e) => setVehicleForm({ ...vehicleForm, rntrc: e.target.value })} />
          </div>
          <Button className="mt-4" variant="lime" disabled={!vehicleForm.plate} onClick={createVehicle}>
            <Plus className="h-4 w-4" />Adicionar veículo
          </Button>
          <div className="mt-5 space-y-2">
            {vehicles.map((item) => (
              <div className="rounded-xl border p-3 text-sm" key={item.id}><b>{item.plate}</b><p className="text-xs text-subtle">{item.renavam || "Sem RENAVAM"} · RNTRC {item.rntrc || "não informado"}</p></div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <h2 className="font-extrabold">Padrões do modo rápido</h2>
        <p className="mt-1 text-sm text-subtle">A configuração do estabelecimento prevalece sobre o padrão global.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-bold">Escopo
            <select className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="global">Padrão global</option>
              {establishments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.tradeName || item.legalName}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">Veículo padrão
            <select className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={defaults.defaultVehicleId} onChange={(e) => setDefaults({ ...defaults, defaultVehicleId: e.target.value })}>
              <option value="">Não definido</option>
              {vehicles.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.plate}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">Condutor padrão
            <select className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={defaults.defaultDriverId} onChange={(e) => setDefaults({ ...defaults, defaultDriverId: e.target.value })}>
              <option value="">Não definido</option>
              {drivers.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.cpf}</option>)}
            </select>
          </label>
          <Input label="Série padrão" value={defaults.defaultSeries} onChange={(e) => setDefaults({ ...defaults, defaultSeries: e.target.value })} />
          <Input label="RNTRC operacional" value={defaults.rntrc} onChange={(e) => setDefaults({ ...defaults, rntrc: e.target.value })} />
          <label className="text-sm font-bold">Ambiente
            <select className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={defaults.environment} onChange={(e) => setDefaults({ ...defaults, environment: e.target.value })}>
              <option value="">Herdar da empresa</option><option value="homologation">Homologação</option><option value="production">Produção</option>
            </select>
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={defaults.quickModeEnabled} onChange={(e) => setDefaults({ ...defaults, quickModeEnabled: e.target.checked })} />
          Habilitar preparação rápida de MDF-e
        </label>
        <Button className="mt-4" variant="lime" onClick={saveDefaults}>Salvar padrões</Button>
      </Card>
    </>
  );
}
