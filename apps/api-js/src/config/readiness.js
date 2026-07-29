export function evaluateReadiness(checks, { shuttingDown = false, workerRequired = false } = {}) {
  return !shuttingDown && checks.database === "up" && checks.redis === "up"
    && checks.prisma === "up" && (!workerRequired || checks.worker === "up");
}
