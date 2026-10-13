import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { iconFiles } from "./generate-icons.mjs";

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(resolve(directory, entry.name)) : resolve(directory, entry.name)))).flat();
}

export async function buildOffline(directory = "dist") {
  const root = resolve(directory);
  const kept = new Set(["index.html", "manifest.webmanifest", ...iconFiles,
    "optimized/branding/logos/outdrawn-logo-dark-01.webp", "optimized/cards/backs/outdrawn-back-dark-logo-01.webp"]);
  for (const name of kept) await readFile(resolve(root, name));
  const paths = [];
  for (const file of await files(root)) {
    const name = relative(root, file).replaceAll("\\", "/");
    if (kept.has(name) || name.startsWith("assets/") || (name.startsWith("optimized/cards/fronts/") && name.includes("/final/") && name.endsWith(".webp"))) paths.push(name);
    else if (/^(cards|branding)\//.test(name) && /\.(png|jpe?g)$/i.test(name)) await unlink(file);
  }
  // Build-only fingerprints are unnecessary in the deployed app.
  await unlink(resolve(root, "optimized/artwork-manifest.json")).catch(error => { if (error.code !== "ENOENT") throw error; });
  paths.sort();
  for (const name of kept) if (!paths.includes(name)) throw new Error(`Missing offline asset: ${name}`);
  const urls = paths.map(name => name === "index.html" ? "/" : `/${name}`);
  await writeFile(resolve(root, "offline-assets.json"), JSON.stringify(urls, null, 2) + "\n");
  const template = await readFile("public/sw.js", "utf8");
  const hash = createHash("sha256").update(template);
  let bytes = 0;
  for (const name of paths) {
    const contents = await readFile(resolve(root, name));
    hash.update(name).update(contents);
    bytes += contents.length;
  }
  const version = hash.digest("hex").slice(0, 16);
  await writeFile(resolve(root, "sw.js"), template.replace("__BUILD_ID__", version).replace("/* __PRECACHE__ */ []", JSON.stringify([...urls, "/offline-assets.json"])));
  console.log(`Offline build ${version}: ${urls.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MiB`);
  return { version, urls, bytes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildOffline(process.argv[2]);
