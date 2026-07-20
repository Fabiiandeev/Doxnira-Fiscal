"use strict";

const { existsSync, statSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { createConnection } = require("node:net");

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const API_ROOT = resolve(__dirname, "..");
const MIN_NODE = [20, 19];
const MIN_PNPM = [11, 0];

function cmpSemver(actual, minimum) {
  for (let i = 0; i < Math.max(actual.length, minimum.length); i++) {
    const a = actual[i] || 0;
    const m = minimum[i] || 0;
    if (a > m) return 1;
    if (a < m) return -1;
  }
  return 0;
}

function parseSemver(s) {
  const m = String(s).trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1]) || 0, Number(m[2]) || 0, Number(m[3]) || 0];
}

function safeSpawn(cmd, args) {
  try {
    return spawnSync(cmd, args, { encoding: "utf8" });
  } catch (e) {
    return { error: e, status: null, stdout: "", stderr: String(e && e.message ? e.message : e) };
  }
}

function spawnOptional(cmdLookup, args) {
  const result = { error: null, status: null, stdout: "", stderr: "" };
  for (const cmd of cmdLookup) {
    try {
      const r = spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" });
      if (!r.error) {
        return r;
      }
      result.error = r.error;
    } catch (e) {
      result.error = e;
    }
  }
  return result;
}

function checkNodeVersion() {
  const ok = { name: "node", label: "Node.js >= 20.19", pass: false, detail: "" };
  const res = spawnSync(process.execPath, ["--version"], { encoding: "utf8" });
  if (res.error || res.status !== 0) {
    ok.detail = "Não foi possível executar o processo Node.";
    return ok;
  }
  const v = parseSemver(res.stdout);
  if (!v) {
    ok.detail = "Versão do Node não identificada.";
    return ok;
  }
  if (cmpSemver(v, MIN_NODE) < 0) {
    ok.detail = `Node ${v.join(".")} é anterior ao mínimo suportado (${MIN_NODE.join(".")}+).`;
    return ok;
  }
  ok.pass = true;
  ok.detail = `Node ${v.join(".")} detectado.`;
  return ok;
}

function checkPnpmVersion() {
  const ok = { name: "pnpm", label: "pnpm >= 11.0", pass: false, detail: "" };
  const candidates = process.platform === "win32"
    ? ["pnpm.cmd", "pnpm.exe", "pnpm.ps1", "pnpm"]
    : ["pnpm"];
  const res = spawnOptional(candidates, ["--version"]);
  if (res.error || res.status !== 0) {
    ok.detail = "pnpm não disponível no PATH. Instale via corepack: corepack enable && corepack prepare pnpm@latest --activate.";
    return ok;
  }
  const v = parseSemver(res.stdout);
  if (!v) {
    ok.detail = "Versão do pnpm não identificada.";
    return ok;
  }
  if (cmpSemver(v, MIN_PNPM) < 0) {
    ok.detail = `pnpm ${v.join(".")} é anterior ao mínimo suportado (${MIN_PNPM.join(".")}+).`;
    return ok;
  }
  ok.pass = true;
  ok.detail = `pnpm ${v.join(".")} detectado.`;
  return ok;
}

function checkDockerAvailable() {
  const ok = { name: "docker", label: "Docker disponível", pass: false, detail: "" };
  const candidates = process.platform === "win32"
    ? ["docker.exe", "docker.cmd", "docker"]
    : ["docker"];
  const res = spawnOptional(candidates, ["--version"]);
  if (res.error || res.status !== 0) {
    ok.detail = "Docker não disponível. Suba o Docker Desktop (Windows/macOS) ou o daemon Docker (Linux).";
    return ok;
  }
  ok.pass = true;
  ok.detail = "Docker detectado.";
  return ok;
}

function checkTestDatabaseEnv(env, enforceFn) {
  const ok = { name: "test-db-env", label: "DATABASE_URL_TEST presente e identificada como teste", pass: false, detail: "" };
  if (!env || typeof env !== "object") {
    ok.detail = "Ambiente de execução inválido.";
    return ok;
  }
  try {
    const target = enforceFn(env);
    ok.pass = true;
    // Intentionally NOT printing host/user/password. Only the database name and schema,
    // which are non-secret identifiers required for diagnostics.
    ok.detail = `Banco de teste identificado: database=${target.database}; schema=${target.schema}; host=<omitted>.`;
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (/TEST_DATABASE_SAFETY_CHECK_FAILED/.test(msg)) {
      ok.detail = "DATABASE_URL_TEST está ausente, malformada ou aponta para banco não identificado como teste. Copie apps/api-js/.env.test.example para apps/api-js/.env.test e preencha com credenciais locais.";
    } else {
      ok.detail = "Falha inesperada na validação de ambiente de teste (sem expor credenciais).";
    }
  }
  return ok;
}

function checkPrismaClientGenerated() {
  const ok = { name: "prisma-client", label: "Prisma Client gerado", pass: false, detail: "" };
  const clientRoot = resolve(REPO_ROOT, "node_modules", ".pnpm");
  if (!existsSync(clientRoot)) {
    ok.detail = "node_modules/.pnpm ausente; execute 'pnpm install' antes dos testes.";
    return ok;
  }
  const clientPath = require.resolve("@prisma/client", { paths: [API_ROOT] });
  if (!clientPath) {
    ok.detail = "@prisma/client não resolúvel; execute 'pnpm install'.";
    return ok;
  }
  try {
    const stat = statSync(clientPath);
    if (!stat.isFile()) {
      ok.detail = "@prisma/client não é um arquivo resolúvel.";
      return ok;
    }
  } catch {
    ok.detail = "@prisma/client não encontrado; execute 'pnpm --filter @ns-fiscal/api-js prisma:generate'.";
    return ok;
  }
  const resolvedClient = (() => {
    try {
      return require.resolve("@prisma/client", { paths: [API_ROOT] });
    } catch {
      return null;
    }
  })();
  if (!resolvedClient) {
    ok.detail = "@prisma/client não resolúvel; execute 'pnpm --filter @ns-fiscal/api-js prisma:generate'.";
    return ok;
  }
  const probe = spawnSync(
    process.execPath,
    ["-e", "require('@prisma/client')"],
    { encoding: "utf8", cwd: API_ROOT },
  );
  if (probe.status !== 0) {
    ok.detail = "Prisma Client instável; execute 'pnpm --filter @ns-fiscal/api-js prisma:generate'.";
    return ok;
  }
  ok.pass = true;
  ok.detail = "Prisma Client acessível.";
  return ok;
}

function parseHostPortFromTestUrl(env) {
  // Reads only host and port from DATABASE_URL_TEST (no user/password touched).
  const url = env && env.DATABASE_URL_TEST;
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url);
    return { host: u.hostname || "localhost", port: u.port ? Number(u.port) : 5432 };
  } catch {
    return null;
  }
}

function checkPostgresReachable(env) {
  const ok = { name: "postgres-reachable", label: "PostgreSQL acessível (porta de teste)", pass: false, detail: "" };
  const target = parseHostPortFromTestUrl(env);
  if (!target || !Number.isFinite(target.port) || target.port <= 0) {
    ok.detail = "Não foi possível extrair host/porta de DATABASE_URL_TEST. Verifique apps/api-js/.env.test.";
    return ok;
  }
  return new Promise((resolveP) => {
    const socket = createConnection({ host: target.host, port: target.port }, () => {
      socket.end();
      ok.pass = true;
      ok.detail = `PostgreSQL aceitou conexão TCP na porta de teste (host=<omitted>; port=${target.port}).`;
      resolveP(ok);
    });
    socket.setTimeout(3000);
    socket.on("timeout", () => {
      socket.destroy();
      ok.detail = `PostgreSQL não respondeu na porta de teste (port=${target.port}). Suba o serviço com: pnpm --filter @ns-fiscal/api-js db:up`;
      resolveP(ok);
    });
    socket.on("error", () => {
      ok.detail = `PostgreSQL inacessível na porta de teste (port=${target.port}). Suba o serviço com: pnpm --filter @ns-fiscal/api-js db:up`;
      resolveP(ok);
    });
  });
}

module.exports = {
  checkNodeVersion,
  checkPnpmVersion,
  checkDockerAvailable,
  checkTestDatabaseEnv,
  checkPrismaClientGenerated,
  checkPostgresReachable,
  _internal: { parseSemver, cmpSemver, parseHostPortFromTestUrl, MIN_NODE, MIN_PNPM },
};
