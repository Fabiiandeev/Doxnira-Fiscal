import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function collectJavaScriptFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? collectJavaScriptFiles(path)
      : path.endsWith(".js")
        ? [path]
        : [];
  });
}

for (const file of collectJavaScriptFiles("src")) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}
