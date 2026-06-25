const fs = require("fs");

const path = "./package.json";
const pkg = require(path);

const sections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

for (const section of sections) {
  if (!pkg[section]) continue;

  for (const name of Object.keys(pkg[section])) {
    if (!pkg[section][name]) {
      delete pkg[section][name];
    }
  }
}

if (!pkg.version) {
  pkg.version = "1.0.0";
}

fs.writeFileSync(path, JSON.stringify(pkg, null, 2));
