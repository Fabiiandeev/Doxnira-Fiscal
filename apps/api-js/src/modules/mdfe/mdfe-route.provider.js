import { randomUUID } from "node:crypto";

const ADJACENCY_VERSION = "IBGE-UF-ADJACENCY-2026.1";
const ADJACENCY = Object.freeze({
  AC: ["AM", "RO"], AL: ["BA", "PE", "SE"], AM: ["AC", "MT", "PA", "RO", "RR"],
  AP: ["PA"], BA: ["AL", "ES", "GO", "MG", "PE", "PI", "SE", "TO"],
  CE: ["PB", "PE", "PI", "RN"], DF: ["GO"], ES: ["BA", "MG", "RJ"],
  GO: ["BA", "DF", "MG", "MS", "MT", "TO"], MA: ["PA", "PI", "TO"],
  MG: ["BA", "ES", "GO", "MS", "RJ", "SP"], MS: ["GO", "MG", "MT", "PR", "SP"],
  MT: ["AM", "GO", "MS", "PA", "RO", "TO"], PA: ["AM", "AP", "MA", "MT", "RR", "TO"],
  PB: ["CE", "PE", "RN"], PE: ["AL", "BA", "CE", "PB", "PI"],
  PI: ["BA", "CE", "MA", "PE", "TO"], PR: ["MS", "SC", "SP"],
  RJ: ["ES", "MG", "SP"], RN: ["CE", "PB"], RO: ["AC", "AM", "MT"],
  RR: ["AM", "PA"], RS: ["SC"], SC: ["PR", "RS"], SE: ["AL", "BA"],
  SP: ["MG", "MS", "PR", "RJ"], TO: ["BA", "GO", "MA", "MT", "PA", "PI"],
});

function normalizeState(value) {
  return String(value || "").trim().toUpperCase();
}

export function validateRouteStates(states) {
  const normalized = states.map(normalizeState).filter(Boolean);
  if (normalized.length < 2) return false;
  if (new Set(normalized).size !== normalized.length) return false;
  return normalized.every((state, index) => (
    index === 0 || ADJACENCY[normalized[index - 1]]?.includes(state)
  ));
}

export function calculateDeterministicStateRoute(originState, destinationState) {
  const origin = normalizeState(originState);
  const destination = normalizeState(destinationState);
  if (!ADJACENCY[origin] || !ADJACENCY[destination]) return null;
  if (origin === destination) return [origin];

  const queue = [[origin]];
  const visited = new Set([origin]);
  while (queue.length) {
    const path = queue.shift();
    for (const next of ADJACENCY[path.at(-1)] || []) {
      if (visited.has(next)) continue;
      const candidate = [...path, next];
      if (next === destination) return candidate;
      visited.add(next);
      queue.push(candidate);
    }
  }
  return null;
}

export class DeterministicMdfeRouteProvider {
  async calculateRoutes(input) {
    if (!input.originCityCode || !input.destinationCityCodes?.length) {
      throw new Error("MDFE_ROUTE_ENDPOINTS_REQUIRED");
    }
    const states = calculateDeterministicStateRoute(input.originState, input.destinationState);
    if (!states || !validateRouteStates(states)) throw new Error("MDFE_ROUTE_NOT_FOUND");
    const calculatedAt = new Date().toISOString();
    return {
      recommended: {
        id: randomUUID(),
        states,
        source: `DETERMINISTIC_FALLBACK:${ADJACENCY_VERSION}`,
        confidence: states.length <= 2 ? "HIGH" : "MEDIUM",
        requiresConfirmation: states.length > 2,
        calculatedAt,
      },
      alternatives: [],
    };
  }
}

export const mdfeRouteProvider = new DeterministicMdfeRouteProvider();
