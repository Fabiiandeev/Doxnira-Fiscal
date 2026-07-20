"use strict";

const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const ENV_FILE = resolve(REPO_ROOT, ".env.docker");

function main() {
  if (!existsSync(ENV_FILE)) {
    process.stderr.write(
      [
        "Arquivo .env.docker não encontrado.",
        "Copie:  cp .env.docker.example .env.docker",
        "",
      ].join("\n"),
    );
    process.exit(2);
  }
  const candidates = process.platform === "win32"
    ? ["docker.exe", "docker.cmd", "docker"]
    : ["docker"];
  let result = null;
  let lastError = null;
  for (const cmd of candidates) {
    try {
      result = spawnSync(
        cmd,
        ["compose", "--env-file", ".env.docker", "logs", "--tail=200"],
        { stdio: "inherit", cwd: REPO_ROOT, env: process.env, shell: process.platform === "win32" },
      );
      if (!result.error) break;
      lastError = result.error;
    } catch (e) {
      lastError = e;
    }
  }
  if (!result || result.error) {
    process.stderr.write(`Não foi possível executar 'docker': ${lastError ? lastError.message : "erro desconhecido"}\n`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

main();
