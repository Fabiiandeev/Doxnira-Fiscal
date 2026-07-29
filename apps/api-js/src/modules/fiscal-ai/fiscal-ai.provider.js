import { AppError } from "../../utils/app-error.js";

const PROVIDERS = new Set(["GENERIC", "NVIDIA_RAG"]);
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_COLLECTION = "fiscal_public";

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function parseInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function parseProviderUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

function parseCollections(value) {
  const collections = String(value || DEFAULT_COLLECTION)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(item));
  return [...new Set(collections)].slice(0, 5);
}

export function getFiscalAiProviderConfig(environment = process.env) {
  const requestedProvider = String(environment.FISCAL_AI_PROVIDER || "GENERIC").toUpperCase();
  const provider = PROVIDERS.has(requestedProvider) ? requestedProvider : "GENERIC";
  const providerUrl = parseProviderUrl(environment.FISCAL_AI_PROVIDER_URL);
  const apiKey = environment.FISCAL_AI_API_KEY || (provider === "GENERIC" ? environment.OPENAI_API_KEY : undefined);
  const collections = parseCollections(environment.FISCAL_AI_RAG_COLLECTIONS);

  return {
    provider,
    providerUrl,
    apiKey,
    model: environment.FISCAL_AI_MODEL || undefined,
    timeoutMs: parseInteger(environment.FISCAL_AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1_000, 120_000),
    collections: collections.length ? collections : [DEFAULT_COLLECTION],
    enableQueryRewriting: parseBoolean(environment.FISCAL_AI_RAG_ENABLE_QUERY_REWRITING),
    rerankerTopK: parseInteger(environment.FISCAL_AI_RAG_RERANKER_TOP_K, 3, 1, 25),
    vdbTopK: parseInteger(environment.FISCAL_AI_RAG_VDB_TOP_K, 15, 1, 400),
    configured: Boolean(providerUrl && (provider === "NVIDIA_RAG" || apiKey)),
  };
}

export function fiscalAiProviderStatus(environment = process.env) {
  const config = getFiscalAiProviderConfig(environment);
  return {
    configured: config.configured,
    provider: config.provider,
    knowledgeBaseEnabled: config.provider === "NVIDIA_RAG",
    collectionCount: config.provider === "NVIDIA_RAG" ? config.collections.length : 0,
  };
}

function buildOperationalContext(facts, hasDocumentContext) {
  return {
    openIssues: facts.issues.length,
    openAlerts: facts.alerts.length,
    incompleteProducts: facts.products.length,
    activeRules: facts.rules,
    importedFiscalDocuments: facts.documents,
    certificateAvailable: Boolean(facts.certificate),
    closingAvailable: Boolean(facts.closing),
    hasDocumentContext,
  };
}

function buildNvidiaUrl(providerUrl) {
  const normalizedPath = providerUrl.pathname.replace(/\/+$/, "");
  if (normalizedPath.endsWith("/v1/generate") || normalizedPath.endsWith("/v1/chat/completions")) {
    return providerUrl.toString();
  }
  const target = new URL(providerUrl.toString());
  target.pathname = `${normalizedPath}/v1/generate`.replace(/\/{2,}/g, "/");
  return target.toString();
}

function responseContent(payload, trim = true) {
  const content = String(
    payload?.answer
    || payload?.output
    || payload?.choices?.[0]?.message?.content
    || payload?.choices?.[0]?.delta?.content
    || "",
  );
  return trim ? content.trim() : content;
}

function citationLabel(source) {
  if (typeof source === "string") return source.trim();
  if (!source || typeof source !== "object") return "";
  return String(
    source.document_name
    || source.file_name
    || source.title
    || source.metadata?.source
    || source.metadata?.filename
    || source.metadata?.file_name
    || source.document_id
    || "",
  ).trim();
}

function normalizeSources(payload) {
  const candidates = Array.isArray(payload?.sources)
    ? payload.sources
    : Array.isArray(payload?.citations)
      ? payload.citations
      : Array.isArray(payload?.citations?.results)
        ? payload.citations.results
        : [];
  return [...new Set(candidates.map(citationLabel).filter(Boolean))].slice(0, 20);
}

function normalizedConfidence(payload) {
  const explicit = Number(payload?.confidence);
  if (Number.isFinite(explicit)) return Math.min(1, Math.max(0, explicit));
  const scores = payload?.citations?.results
    ?.map((item) => Number(item?.score))
    .filter(Number.isFinite);
  return scores?.length ? Math.min(1, Math.max(0, Math.max(...scores))) : 0;
}

export function parseNvidiaResponse(rawBody, contentType = "") {
  if (contentType.includes("application/json")) {
    const payload = JSON.parse(rawBody);
    return {
      answer: responseContent(payload),
      confidence: normalizedConfidence(payload),
      sources: normalizeSources(payload),
    };
  }

  let answer = "";
  let confidence = 0;
  const sources = [];
  for (const line of rawBody.split(/\r?\n/)) {
    const data = line.startsWith("data:") ? line.slice(5).trim() : "";
    if (!data || data === "[DONE]") continue;
    try {
      const payload = JSON.parse(data);
      answer += responseContent(payload, false);
      confidence = Math.max(confidence, normalizedConfidence(payload));
      sources.push(...normalizeSources(payload));
    } catch {
      // SSE keep-alive and non-JSON stage announcements are intentionally ignored.
    }
  }
  return { answer: answer.trim(), confidence, sources: [...new Set(sources)].slice(0, 20) };
}

function buildConversationMessages(message, operationalContext, conversationHistory) {
  const history = conversationHistory.flatMap((entry) => [
    { role: "user", content: entry.question },
    { role: "assistant", content: entry.answer },
  ]);
  return [
    {
      role: "system",
      content: "Você é a FiscalAI. Responda em português do Brasil, use somente evidências recuperadas e fatos operacionais fornecidos, cite as fontes e sinalize quando não houver base suficiente. Nunca invente regra, alíquota ou fundamento legal.",
    },
    ...history,
    {
      role: "user",
      content: `${message}\n\nContexto operacional agregado: ${JSON.stringify(operationalContext)}`,
    },
  ];
}

async function requestProvider({ config, message, facts, hasDocumentContext, conversationHistory, fetchImpl }) {
  const headers = { "content-type": "application/json" };
  if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;

  const operationalContext = buildOperationalContext(facts, hasDocumentContext);
  const isNvidia = config.provider === "NVIDIA_RAG";
  const url = isNvidia ? buildNvidiaUrl(config.providerUrl) : config.providerUrl.toString();
  const body = isNvidia
    ? {
        messages: buildConversationMessages(message, operationalContext, conversationHistory),
        use_knowledge_base: true,
        collection_names: config.collections,
        enable_citations: true,
        enable_reranker: true,
        enable_query_rewriting: config.enableQueryRewriting,
        reranker_top_k: config.rerankerTopK,
        vdb_top_k: config.vdbTopK,
        temperature: 0,
        ...(config.model ? { model: config.model } : {}),
      }
    : {
        message,
        context: {
          ...operationalContext,
          conversation: conversationHistory,
        },
        ...(config.model ? { model: config.model } : {}),
      };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new AppError("Provedor de IA indisponível.", "AI_PROVIDER_ERROR", 502);
    }
    const rawBody = await response.text();
    const result = isNvidia
      ? parseNvidiaResponse(rawBody, response.headers.get("content-type") || "")
      : (() => {
          const payload = JSON.parse(rawBody);
          return {
            answer: responseContent(payload),
            confidence: normalizedConfidence(payload),
            sources: normalizeSources(payload),
          };
        })();
    if (!result.answer) {
      throw new AppError("O provedor não retornou resposta.", "AI_EMPTY_RESPONSE", 502);
    }
    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error?.name === "AbortError") {
      throw new AppError("O provedor de IA excedeu o tempo limite.", "AI_PROVIDER_TIMEOUT", 504);
    }
    throw new AppError("Provedor de IA indisponível.", "AI_PROVIDER_ERROR", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function askFiscalAi({
  message,
  facts,
  hasDocumentContext = false,
  conversationHistory = [],
  environment = process.env,
  fetchImpl = globalThis.fetch,
}) {
  const config = getFiscalAiProviderConfig(environment);
  if (!config.configured) {
    return {
      configured: false,
      code: "AI_CONFIGURATION_REQUIRED",
      message: "Configuração de IA necessária",
      ...fiscalAiProviderStatus(environment),
    };
  }
  const result = await requestProvider({
    config,
    message,
    facts,
    hasDocumentContext,
    conversationHistory: conversationHistory.slice(-6),
    fetchImpl,
  });
  return {
    configured: true,
    provider: config.provider,
    knowledgeBaseUsed: config.provider === "NVIDIA_RAG",
    ...result,
  };
}
