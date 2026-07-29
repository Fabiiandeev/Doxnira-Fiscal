import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_DATASET = "rag/fiscalai-operacional-v1";
const DEFAULT_COLLECTION = "multimodal_data";
const DEFAULT_ELASTICSEARCH_URL = "http://localhost:9200";
const DEFAULT_EMBEDDING_URL = "https://integrate.api.nvidia.com/v1/embeddings";
const DEFAULT_EMBEDDING_MODEL = "nvidia/llama-nemotron-embed-vl-1b-v2";
const VECTOR_DIMENSIONS = 2048;
const CHUNK_SIZE = 1_800;
const CHUNK_OVERLAP = 240;
const EMBEDDING_BATCH_SIZE = 8;

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value) {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

export function splitMarkdown(value, maxLength = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const text = normalizeText(value);
  if (!text) return [];

  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let start = 0; start < paragraph.length; start += maxLength - overlap) {
        chunks.push(paragraph.slice(start, start + maxLength).trim());
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }

    chunks.push(current);
    const prefix = current.slice(-overlap).replace(/^\S*\s/, "").trim();
    current = prefix ? `${prefix}\n\n${paragraph}` : paragraph;
  }

  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

function parseManifest(value) {
  return new Map(
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^([a-f0-9]{64})\s{2}(.+)$/i);
        if (!match) throw new Error(`Linha inválida no manifesto: ${line}`);
        return [match[2], match[1].toLowerCase()];
      }),
  );
}

async function requestJson(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const raw = await response.text();
      const payload = raw ? JSON.parse(raw) : {};
      if (response.ok) return payload;
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`HTTP ${response.status} em ${new URL(url).pathname}`);
      }
      lastError = new Error(`HTTP ${response.status} em ${new URL(url).pathname}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
    }
  }
  throw lastError;
}

async function embedTexts(texts, apiKey, embeddingUrl, model) {
  const vectors = [];
  for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE);
    const payload = await requestJson(embeddingUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        input: batch,
        model,
        input_type: "passage",
        encoding_format: "float",
        truncate: "END",
      }),
    });
    const ordered = [...(payload.data || [])].sort((a, b) => a.index - b.index);
    if (ordered.length !== batch.length) {
      throw new Error("O provedor não retornou um embedding para cada chunk.");
    }
    for (const item of ordered) {
      if (!Array.isArray(item.embedding) || item.embedding.length !== VECTOR_DIMENSIONS) {
        throw new Error(`Embedding com dimensão inválida; esperado ${VECTOR_DIMENSIONS}.`);
      }
      vectors.push(item.embedding);
    }
    console.log(`Embeddings: ${Math.min(offset + batch.length, texts.length)}/${texts.length}`);
  }
  return vectors;
}

async function ensureCollection(elasticsearchUrl, collection) {
  const indexUrl = `${elasticsearchUrl}/${encodeURIComponent(collection)}`;
  const exists = await fetch(indexUrl, { method: "HEAD" });
  if (exists.ok) return;
  if (exists.status !== 404) {
    throw new Error(`Não foi possível verificar a coleção: HTTP ${exists.status}.`);
  }
  await requestJson(indexUrl, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mappings: {
        properties: {
          vector: {
            type: "dense_vector",
            dims: VECTOR_DIMENSIONS,
            index: true,
            similarity: "cosine",
          },
        },
      },
    }),
  });
}

async function replaceDocuments(elasticsearchUrl, collection, documents) {
  const sourceNames = [...new Set(documents.map((document) => document.metadata.source.source_name))];
  await requestJson(
    `${elasticsearchUrl}/${encodeURIComponent(collection)}/_delete_by_query?conflicts=proceed&refresh=true`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: {
          terms: {
            "metadata.source.source_name.keyword": sourceNames,
          },
        },
      }),
    },
  );

  const body = documents
    .flatMap((document) => [
      JSON.stringify({
        index: {
          _index: collection,
          _id: document.id,
        },
      }),
      JSON.stringify({
        text: document.text,
        vector: document.vector,
        metadata: document.metadata,
      }),
    ])
    .join("\n");

  const response = await requestJson(`${elasticsearchUrl}/_bulk?refresh=wait_for`, {
    method: "POST",
    headers: { "content-type": "application/x-ndjson" },
    body: `${body}\n`,
  });
  const failures = (response.items || []).filter((item) => item.index?.error);
  if (response.errors || failures.length) {
    throw new Error(`Elasticsearch recusou ${failures.length} chunk(s).`);
  }
}

async function main() {
  const datasetRoot = path.resolve(argument("dataset", DEFAULT_DATASET));
  const corpusRoot = path.join(datasetRoot, "corpus");
  const collection = argument("collection", DEFAULT_COLLECTION).toLowerCase();
  const elasticsearchUrl = argument("elasticsearch-url", DEFAULT_ELASTICSEARCH_URL).replace(/\/+$/, "");
  const embeddingUrl = argument("embedding-url", DEFAULT_EMBEDDING_URL);
  const embeddingModel = argument("embedding-model", DEFAULT_EMBEDDING_MODEL);
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY não configurada.");

  const manifest = parseManifest(await readFile(path.join(datasetRoot, "manifest.sha256"), "utf8"));
  const fileNames = (await readdir(corpusRoot))
    .filter((name) => /\.(md|txt)$/i.test(name))
    .sort();
  if (!fileNames.length) throw new Error("Corpus vazio.");

  const chunks = [];
  for (const fileName of fileNames) {
    const content = await readFile(path.join(corpusRoot, fileName), "utf8");
    const actualHash = sha256(content);
    if (manifest.get(fileName) !== actualHash) {
      throw new Error(`Falha de integridade no corpus: ${fileName}.`);
    }
    const title = normalizeText(content).match(/^#\s+(.+)$/m)?.[1] || fileName;
    for (const [chunkIndex, text] of splitMarkdown(content).entries()) {
      chunks.push({
        id: sha256(`${fileName}:${actualHash}:${chunkIndex}`),
        text,
        metadata: {
          source: {
            source_name: fileName,
            source_id: fileName,
          },
          content_metadata: {
            type: "text",
            subtype: path.extname(fileName).slice(1).toLowerCase(),
            title,
            page_number: 1,
            chunk_index: chunkIndex,
            corpus: "fiscalai-operacional-v1",
            sha256: actualHash,
          },
        },
      });
    }
  }

  console.log(`Corpus validado: ${fileNames.length} arquivo(s), ${chunks.length} chunk(s).`);
  const vectors = await embedTexts(
    chunks.map((chunk) => chunk.text),
    apiKey,
    embeddingUrl,
    embeddingModel,
  );
  vectors.forEach((vector, index) => {
    chunks[index].vector = vector;
  });

  await ensureCollection(elasticsearchUrl, collection);
  await replaceDocuments(elasticsearchUrl, collection, chunks);
  console.log(`INGESTION_COMPLETE collection=${collection} files=${fileNames.length} chunks=${chunks.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`INGESTION_FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}
