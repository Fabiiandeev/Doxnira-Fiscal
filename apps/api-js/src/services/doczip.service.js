import { gunzipSync } from "node:zlib";

import { AppError } from "../utils/app-error.js";

function decodeEntities(value) {
  return String(value)
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

export function extractDocZips(responseXml) {
  const xml = decodeEntities(responseXml);
  const regex =
    /<(?:\w+:)?docZip\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?docZip>/gi;
  const documents = [];
  for (const match of xml.matchAll(regex)) {
    const attributes = match[1];
    const nsu = attributes.match(/\bNSU=["']([^"']+)["']/i)?.[1] || null;
    const schema = attributes.match(/\bschema=["']([^"']+)["']/i)?.[1] || "unknown";
    try {
      const content = gunzipSync(Buffer.from(match[2].replace(/\s/g, ""), "base64"))
        .toString("utf8");
      documents.push({ nsu, schema, xml: content });
    } catch {
      throw new AppError("docZip inválido.", "DOCZIP_DECODE_ERROR", 502);
    }
  }
  return documents;
}
