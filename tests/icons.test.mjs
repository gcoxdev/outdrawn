import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { generateIcons, iconFiles } from "../scripts/generate-icons.mjs";

test("icon declarations resolve to correctly sized images with purpose-appropriate padding", async () => {
  const manifest = JSON.parse(await readFile("public/manifest.webmanifest", "utf8"));
  for (const purpose of ["any", "maskable"]) {
    assert.deepEqual(manifest.icons.filter(icon => icon.purpose === purpose).map(icon => icon.sizes), ["192x192", "512x512"]);
  }
  const html = await readFile("index.html", "utf8");
  const links = [...html.matchAll(/<link\s[^>]*>/g)].map(([tag]) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])))
    .filter(link => ["icon", "apple-touch-icon"].includes(link.rel));
  assert(links.some(link => link.href === "/favicon.ico"));
  assert(links.some(link => link.rel === "apple-touch-icon" && link.sizes === "180x180"));
  for (const icon of [...manifest.icons, ...links.filter(link => link.type !== "image/x-icon")]) {
    const file = icon.src ?? icon.href;
    const { data, info } = await sharp(`public${file}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(`${info.width}x${info.height}`, icon.sizes, file);
    const opaque = icon.purpose === "maskable" || icon.rel === "apple-touch-icon";
    let left = info.width, right = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * 4;
      if (opaque) assert.equal(data[offset + 3], 255, `${file} must be fully opaque`);
      const isMark = opaque
        ? Math.max(Math.abs(data[offset] - 18), Math.abs(data[offset + 1] - 17), Math.abs(data[offset + 2] - 15)) > 20
        : data[offset + 3] > 20;
      if (!isMark) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      if (icon.purpose === "maskable") {
        const radius = Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2);
        assert(radius <= info.width * 0.4, `${file}: artwork escapes the circular safe zone`);
      }
    }
    const coverage = (right - left + 1) / info.width;
    if (!opaque) assert(coverage >= 0.95, `${file}: excess padding makes the mark too small`);
    else if (icon.purpose === "maskable") assert(coverage >= 0.75, `${file}: maskable mark is too small`);
    else assert(coverage >= 0.89 && coverage <= 0.95, `${file}: Apple icon padding`);
  }
});

test("icon generation is reproducible and favicon contains native 16/32/48px frames", async () => {
  const root = await mkdtemp(join(tmpdir(), "outdrawn-icons-"));
  try {
    await generateIcons(root);
    for (const file of iconFiles) assert.deepEqual(await readFile(join(root, file)), await readFile(`public/${file}`), file);
    const ico = await readFile(join(root, "favicon.ico"));
    assert.equal(ico.readUInt16LE(0), 0);
    assert.equal(ico.readUInt16LE(2), 1);
    assert.equal(ico.readUInt16LE(4), 3);
    for (const [index, size] of [16, 32, 48].entries()) {
      const entry = 6 + index * 16;
      assert.equal(ico[entry], size); assert.equal(ico[entry + 1], size);
      const length = ico.readUInt32LE(entry + 8), offset = ico.readUInt32LE(entry + 12);
      const metadata = await sharp(ico.subarray(offset, offset + length)).metadata();
      assert.equal(metadata.width, size); assert.equal(metadata.height, size);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
