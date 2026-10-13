import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { optimizeArtwork } from "../scripts/optimize-artwork.mjs";

test("lossless artwork preserves pixels and sources, and rebuilds changed inputs", async () => {
  const root = await mkdtemp(join(tmpdir(), "outdrawn-artwork-"));
  const name = "branding/logos/outdrawn-logo-dark-01.png";
  const target = join(root, "optimized", name.replace(/\.png$/, ".webp"));
  try {
    await mkdir(join(root, "branding/logos"), { recursive: true });
    const original = await readFile(`public/${name}`);
    await writeFile(join(root, name), original);
    await optimizeArtwork(root);
    const compressed = await readFile(target);
    assert(compressed.length < original.length);
    const pixels = buffer => sharp(buffer).flatten({ background: "black" }).raw().toBuffer();
    assert.deepEqual(await pixels(compressed), await pixels(original));
    assert.deepEqual(await readFile(join(root, name)), original);
    await optimizeArtwork(root);
    assert.deepEqual(await readFile(target), compressed);
    const replacement = await sharp({ create: { width: 10, height: 10, channels: 4, background: "red" } }).png().toBuffer();
    await writeFile(join(root, name), replacement);
    await optimizeArtwork(root);
    assert.deepEqual(await pixels(await readFile(target)), await pixels(replacement));
    await writeFile(target, "corrupt generated artifact");
    await optimizeArtwork(root);
    assert.deepEqual(await pixels(await readFile(target)), await pixels(replacement));
  } finally { await rm(root, { recursive: true, force: true }); }
});
