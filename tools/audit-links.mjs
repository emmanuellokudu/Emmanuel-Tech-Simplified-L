import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const htmlFiles = [];
const walk = (directory) => {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      if (![".git", "node_modules"].includes(name)) walk(path);
    } else if (name.endsWith(".html")) htmlFiles.push(path);
  }
};
walk(root);

const missing = [];
const external = new Set();
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const srcset of html.matchAll(/srcset="([^"]+)"/g)) {
    references.push(...srcset[1].split(",").map((candidate) => candidate.trim().split(/\s+/)[0]));
  }
  for (const reference of references) {
    if (/^(https?:)?\/\//.test(reference)) {
      if (reference.startsWith("http")) external.add(reference);
      continue;
    }
    if (/^(mailto:|tel:|data:|#)/.test(reference)) continue;
    const clean = decodeURIComponent(reference.split("#")[0].split("?")[0]);
    if (!clean) continue;
    const target = normalize(join(dirname(file), clean));
    if (!existsSync(target)) missing.push(`${relative(root, file)} -> ${reference}`);
  }
}

console.log(`HTML pages checked: ${htmlFiles.length}`);
console.log(`Unique external URLs found: ${external.size}`);
console.log(`Missing internal targets: ${missing.length}`);
if (missing.length) {
  console.error(missing.join("\n"));
  process.exitCode = 1;
}
console.log("External URLs:");
console.log([...external].sort().join("\n"));
