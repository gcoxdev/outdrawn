import sharp from "sharp";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir, stat, unlink } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { pathToFileURL } from "node:url";
const cardBacks = JSON.parse(await readFile(new URL("../src/data/cardBacks.json", import.meta.url), "utf8"));
const cardBackSources = new Set(cardBacks.map(back => `cards/backs/${back.file}.png`));

async function files(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(resolve(root, entry.name)) : resolve(root, entry.name)))).flat();
}

export async function optimizeArtwork(source = "public", output = resolve(source, "optimized")) {
  const root = resolve(source);
  const destination = resolve(output);
  await mkdir(destination, { recursive: true });
  const cachePath = resolve(destination, "artwork-manifest.json");
  let previous = {};
  try { previous = JSON.parse(await readFile(cachePath, "utf8")); } catch {}
  const manifest = {};
  const selected = (await files(root)).filter(file => {
    const name = relative(root, file).replaceAll("\\", "/");
    return name === "branding/logos/outdrawn-logo-dark-01.png" || cardBackSources.has(name) ||
      (name.startsWith("cards/fronts/") && name.includes("/final/") && name.endsWith(".png"));
  }).sort();
  if (!selected.length) throw new Error("No source artwork found");
  let sourceBytes = 0, outputBytes = 0;
  for (const file of selected) {
    const name = relative(root, file).replaceAll("\\", "/");
    const target = name.replace(/\.png$/, ".webp");
    const input = await readFile(file);
    const hash = createHash("sha256").update(input).update(JSON.stringify(sharp.versions)).update("lossless-effort4-v1").digest("hex");
    const path = resolve(destination, target);
    let existing;
    try { existing = await readFile(path); } catch {}
    const outputHash = existing && createHash("sha256").update(existing).digest("hex");
    if (previous[target]?.sourceHash !== hash || previous[target]?.outputHash !== outputHash || !existing) {
      await mkdir(dirname(path), { recursive: true });
      await sharp(input).webp({ lossless: true, effort: 4 }).toFile(path);
    }
    const compressed = await readFile(path);
    manifest[target] = { sourceHash: hash, outputHash: createHash("sha256").update(compressed).digest("hex"), sourceBytes: input.length, bytes: compressed.length };
    sourceBytes += input.length;
    outputBytes += (await stat(path)).size;
  }
  // Remove generated images whose source was removed. Never touch originals.
  for (const file of await files(destination)) {
    const name = relative(destination, file).replaceAll("\\", "/");
    if (name.endsWith(".webp") && !manifest[name]) await unlink(file);
  }
  await writeFile(cachePath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Lossless artwork: ${selected.length} images, ${(sourceBytes / 1048576).toFixed(1)} → ${(outputBytes / 1048576).toFixed(1)} MiB`);
  return { count: selected.length, sourceBytes, outputBytes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await optimizeArtwork();
