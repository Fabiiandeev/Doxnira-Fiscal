import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateXML } from "xmllint-wasm";

import { AppError } from "../../utils/app-error.js";

const schemaDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "schemas",
  "PL_MDFe_300b_NT012025_1.05",
);

let schemaFilesPromise;

async function loadSchemaFiles() {
  if (!schemaFilesPromise) {
    schemaFilesPromise = (async () => {
      const names = (await readdir(schemaDirectory))
        .filter((name) => name.toLowerCase().endsWith(".xsd"))
        .sort();
      const files = await Promise.all(
        names.map(async (fileName) => ({
          fileName,
          contents: await readFile(join(schemaDirectory, fileName), "utf8"),
        })),
      );
      const main = files.find((file) => file.fileName === "mdfe_v3.00.xsd");
      if (!main) {
        throw new AppError(
          "Schema principal do MDF-e não encontrado.",
          "MDFE_XSD_NOT_FOUND",
          500,
        );
      }
      return { files, main, preload: files.filter((file) => file !== main) };
    })();
  }
  return schemaFilesPromise;
}

export async function validateMdfeXmlWithXsd(xml) {
  const { main, preload } = await loadSchemaFiles();
  const result = await validateXML({
    xml: [{ fileName: "mdfe.xml", contents: xml }],
    schema: [main],
    preload,
    maxMemoryPages: 8_192,
  });
  return {
    valid: result.valid,
    errors: result.errors.map((error) => ({
      message: error.message,
      line: error.loc?.lineNumber ?? null,
    })),
  };
}

export async function validateMdfeEventXmlWithXsd(xml) {
  const { files } = await loadSchemaFiles();
  const main = files.find((file) => file.fileName === "eventoMDFe_v3.00.xsd");
  if (!main) {
    throw new AppError(
      "Schema de evento do MDF-e nÃ£o encontrado.",
      "MDFE_EVENT_XSD_NOT_FOUND",
      500,
    );
  }
  const result = await validateXML({
    xml: [{ fileName: "evento-mdfe.xml", contents: xml }],
    schema: [main],
    preload: files.filter((file) => file !== main),
    maxMemoryPages: 8_192,
  });
  return {
    valid: result.valid,
    errors: result.errors.map((error) => ({
      message: error.message,
      line: error.loc?.lineNumber ?? null,
    })),
  };
}
