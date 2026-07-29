import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePredominantProduct,
  groupNfesForAutomaticMdfe,
} from "../../src/modules/mdfe/mdfe-auto.service.js";
import {
  calculateDeterministicStateRoute,
  DeterministicMdfeRouteProvider,
  validateRouteStates,
} from "../../src/modules/mdfe/mdfe-route.provider.js";

function note(id, {
  companyId = "company-a",
  establishmentKey = "company-a:cnpj",
  loadingCityCode = "5208707",
  loadingState = "GO",
  destinationState = "SP",
  destinationCityCode = "3509502",
  cargoOwnershipType = "OWN_CARGO",
  itemValue = 100,
  description = "Produto A",
  ncm = "01012100",
} = {}) {
  return {
    id,
    companyId,
    mdfeEligibility: {
      establishmentKey,
      loadingCityCode,
      loadingState,
      destinationState,
      destinationCityCode,
      cargoOwnershipType,
      issuerType: "TRANSPORTADOR_CARGA_PROPRIA",
      transportMode: "RODOVIARIO",
      contractorId: null,
    },
    items: [{ itemNumber: 1, description, ncm, valorTotal: itemValue }],
  };
}

test("agrupa mesma UF e mesmo município em um MDF-e", () => {
  const groups = groupNfesForAutomaticMdfe([note("1"), note("2"), note("3")]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, 3);
});

test("mantém municípios diferentes da mesma UF no mesmo grupo", () => {
  const groups = groupNfesForAutomaticMdfe([
    note("1", { destinationCityCode: "3509502" }),
    note("2", { destinationCityCode: "3550308" }),
    note("3", { destinationCityCode: "3548500" }),
  ]);
  assert.equal(groups.length, 1);
});

test("separa UFs diferentes", () => {
  const groups = groupNfesForAutomaticMdfe([
    note("1", { destinationState: "SP" }),
    note("2", { destinationState: "MG" }),
    note("3", { destinationState: "BA" }),
  ]);
  assert.equal(groups.length, 3);
});

test("separa estabelecimentos diferentes", () => {
  const groups = groupNfesForAutomaticMdfe([
    note("1", { establishmentKey: "matriz" }),
    note("2", { establishmentKey: "filial" }),
  ]);
  assert.equal(groups.length, 2);
});

test("separa município de carregamento diferente", () => {
  const groups = groupNfesForAutomaticMdfe([
    note("1", { loadingCityCode: "5208707" }),
    note("2", { loadingCityCode: "5212501" }),
  ]);
  assert.equal(groups.length, 2);
});

test("não mistura carga própria e de terceiros", () => {
  const groups = groupNfesForAutomaticMdfe([
    note("1", { cargoOwnershipType: "OWN_CARGO" }),
    note("2", { cargoOwnershipType: "THIRD_PARTY_CARGO" }),
  ]);
  assert.equal(groups.length, 2);
});

test("produto predominante é calculado por valor dos itens", () => {
  const result = calculatePredominantProduct([
    note("1", { itemValue: 800, description: "Principal" }),
    note("2", { itemValue: 200, description: "Secundário" }),
  ]);
  assert.equal(result.description, "Principal");
  assert.equal(result.participation, 0.8);
  assert.equal(result.confidence, "HIGH");
  assert.equal(result.origins[0].nfeId, "1");
});

test("produto sem participação suficiente exige confirmação", () => {
  const result = calculatePredominantProduct([
    note("1", { itemValue: 25, description: "A" }),
    note("2", { itemValue: 25, description: "B" }),
    note("3", { itemValue: 25, description: "C" }),
    note("4", { itemValue: 25, description: "D" }),
  ]);
  assert.equal(result.requiresConfirmation, true);
  assert.equal(result.confidence, "LOW");
});

test("percurso GO para SP usa corredor limítrofe coerente", () => {
  assert.deepEqual(calculateDeterministicStateRoute("GO", "SP"), ["GO", "MG", "SP"]);
});

test("rota rejeita UF duplicada e salto não limítrofe", () => {
  assert.equal(validateRouteStates(["GO", "GO", "SP"]), false);
  assert.equal(validateRouteStates(["GO", "SP"]), false);
});

test("provider marca fallback não direto para confirmação", async () => {
  const provider = new DeterministicMdfeRouteProvider();
  const result = await provider.calculateRoutes({
    originCityCode: "5208707",
    originState: "GO",
    destinationCityCodes: ["3550308"],
    destinationState: "SP",
  });
  assert.match(result.recommended.source, /^DETERMINISTIC_FALLBACK:/);
  assert.equal(result.recommended.requiresConfirmation, true);
});

test("provider bloqueia rota sem origem e destino", async () => {
  const provider = new DeterministicMdfeRouteProvider();
  await assert.rejects(
    provider.calculateRoutes({ originState: "GO", destinationState: "SP", destinationCityCodes: [] }),
    /MDFE_ROUTE_ENDPOINTS_REQUIRED/,
  );
});
