let shuttingDown = false;
export const runtimeState = {
  get shuttingDown() { return shuttingDown; },
  beginShutdown() { shuttingDown = true; },
};
