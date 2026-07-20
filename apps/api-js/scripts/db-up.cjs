"use strict";

const { createServer } = require("node:net");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const ENV_FILE = resolve(REPO_ROOT, ".env.docker");
const ENV_EXAMPLE = resolve(REPO_ROOT, ".env.docker.example");

function parseEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function findPort(env) {
  const p = Number.parseInt(env.POSTGRES_PORT || process.env.POSTGRES_PORT || "5432", 10);
  if (!Number.isFinite(p) || p <= 0 || p > 65535) {
    throw new Error(`POSTGRES_PORT inválido (use 1..65535).`);
  }
  return p;
}

function checkPortFree(port) {
  return new Promise((resolveP, rejectP) => {
    const srv = createServer();
    srv.unref();
    srv.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolveP({ free: false });
      } else {
        rejectP(err);
      }
    });
    srv.once("listening", () => {
      srv.close(() => resolveP({ free: true }));
    });
    srv.listen(port, "127.0.0.1");
  });
}

function spawnDocker(args) {
  const candidates = process.platform === "win32"
    ? ["docker.exe", "docker.cmd", "docker"]
    : ["docker"];
  for (const cmd of candidates) {
    try {
      const result = spawnSync(cmd, args, {
        stdio: "inherit",
        cwd: REPO_ROOT,
        env: process.env,
        shell: process.platform === "win32",
      });
      if (!result.error) return result.status ?? 1;
    } catch {
      // try next
    }
  }
  throw new Error(`Não foi possível executar 'docker'. Verifique se o Docker está disponível no PATH.`);
}

async function main() {
  if (!existsSync(ENV_FILE)) {
    process.stderr.write(
      [
        "Arquivo .env.docker não encontrado.",
        "Copie o template e preencha as credenciais locais (sem versionar):",
        "  cp .env.docker.example .env.docker",
        "Depois edite .env.docker com valores gerados localmente e execute novamente:",
        "  pnpm --filter @ns-fiscal/api-js db:up",
        "",
      ].join("\n"),
    );
    process.exit(2);
  }
  if (!existsSync(ENV_EXAMPLE)) {
    process.stderr.write("Template .env.docker.example ausente; verifique o repositório.\n");
    process.exit(2);
  }

  const env = parseEnvFile(ENV_FILE);
  if (!env.POSTGRES_PASSWORD) {
    process.stderr.write(
      [
        "POSTGRES_PASSWORD não definido em .env.docker.",
        "Gere uma senha localmente (ex.: openssl rand -base64 24) e preencha o valor em .env.docker.",
        "",
      ].join("\n"),
    );
    process.exit(2);
  }
  if (!env.POSTGRES_USER || !env.POSTGRES_DB) {
    process.stderr.write("POSTGRES_USER e POSTGRES_DB são obrigatórios em .env.docker.\n");
    process.exit(2);
  }

  const port = findPort(env);
  const { free } = await checkPortFree(port);
  if (!free) {
    process.stderr.write(
      [
        `Porta ${port} já está em uso neste host.`,
        "O Compose novo NÃO recria nem reutiliza containers externos.",
        "Opções:",
        "  - altere POSTGRES_PORT em .env.docker para uma porta livre e ajuste DATABASE_URL_TEST em apps/api-js/.env.test; OU",
        "  - pare manualmente qualquer container existente que esteja ocupando a porta e execute novamente.",
        "",
      ].join("\n"),
    );
    process.exit(3);
  }

  const status = spawnDocker(["compose", "--env-file", ".env.docker", "up", "-d", "postgres"]);
  process.exit(status);
}

main().catch((err) => {
  process.stderr.write(`db:up: erro inesperado: ${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
});
