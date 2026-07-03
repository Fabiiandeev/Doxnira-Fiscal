import { CnpjWsProvider } from "./cnpj-ws-provider.js";
import { BrasilApiProvider } from "./brasilapi-provider.js";
import { ReceitawsProvider } from "./receitaws-provider.js";
import { CnpjWsV2Provider } from "./cnpj-wsv2-provider.js";
import { SintegraProvider } from "./sintegra-provider.js";

export { CnpjWsProvider, BrasilApiProvider, ReceitawsProvider, CnpjWsV2Provider, SintegraProvider };

const PROVIDERS = [
  new CnpjWsProvider(),
  new BrasilApiProvider(),
  new ReceitawsProvider(),
  new CnpjWsV2Provider(),
];

const IE_PROVIDER = new SintegraProvider();

export function getProviders() {
  return [...PROVIDERS].sort((a, b) => a.priority - b.priority);
}

export function getIeProvider() {
  return IE_PROVIDER;
}
