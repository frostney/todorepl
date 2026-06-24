import { existsSync, readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";

const roots = [
  "README.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "VISION.md",
  "DEFINITION_OF_READY.md",
  "DEFINITION_OF_DONE.md",
  "docs",
];
const markdownLinkPattern = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;

const failures: string[] = [];

for (const file of await markdownFiles(roots)) {
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(markdownLinkPattern)) {
    const rawTarget = match[1];
    if (!rawTarget) continue;
    const target = rawTarget.trim();
    if (isExternalLink(target) || target.startsWith("#") || target.startsWith("mailto:")) continue;
    const [pathPart] = target.split("#");
    if (!pathPart) continue;
    const resolved = normalize(resolve(dirname(file), decodeURIComponent(pathPart)));
    if (!existsSync(resolved)) failures.push(`${file}: broken link target ${target}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

async function markdownFiles(paths: readonly string[]): Promise<string[]> {
  const files: string[] = [];
  for (const path of paths) {
    files.push(...(await markdownFilesForPath(path)));
  }
  return files.sort();
}

async function markdownFilesForPath(path: string): Promise<string[]> {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return path.endsWith(".md") ? [path] : [];
  const entries = (await readdir(path)).map((entry) => join(path, entry));
  return markdownFiles(entries);
}

function isExternalLink(target: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target);
}
