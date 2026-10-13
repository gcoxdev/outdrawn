import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const background = "#12110f";
// Use the existing, tightly trimmed artwork without changing its proportions.
// Favicons fill their tiny canvas; adaptive icons keep the whole mark inside
// the platform's circular safe zone (40% radius), with 1% breathing room.
export const iconVariants = [
  ...[16, 32, 48].map(size => ({ path: `icons/favicon-${size}.png`, size, fill: 1, opaque: false })),
  ...[192, 512].map(size => ({ path: `icons/outdrawn-app-${size}.png`, size, fill: 0.98, opaque: false })),
  ...[192, 512].map(size => ({ path: `icons/outdrawn-maskable-${size}.png`, size, fill: 0.78, opaque: true })),
  { path: "apple-touch-icon.png", size: 180, fill: 0.92, opaque: true }
];
export const iconFiles = [...iconVariants.map(icon => icon.path), "favicon.ico"];

export async function generateIcons(directory = "public", source = "public/icons/outdrawn-target-icon-trimmed.png") {
  await mkdir(resolve(directory, "icons"), { recursive: true });
  const favicons = [];
  for (const icon of iconVariants) {
    const contentSize = Math.round(icon.size * icon.fill);
    const content = await sharp(source).resize(contentSize, contentSize, { fit: "inside" }).png().toBuffer();
    const output = await sharp({ create: { width: icon.size, height: icon.size, channels: 4,
      background: icon.opaque ? background : { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: content, gravity: "centre" }]).png().toBuffer();
    await writeFile(resolve(directory, icon.path), output);
    if (icon.size <= 48) favicons.push({ size: icon.size, data: output });
  }
  // ICO directory with native 16/32/48px PNG frames for tabs and shortcuts.
  const header = Buffer.alloc(6 + 16 * favicons.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(favicons.length, 4);
  let offset = header.length;
  favicons.forEach(({ size, data }, index) => {
    const entry = 6 + 16 * index;
    header[entry] = size; header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  await writeFile(resolve(directory, "favicon.ico"), Buffer.concat([header, ...favicons.map(icon => icon.data)]));
  console.log(`Generated ${iconFiles.length} browser and app icons`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await generateIcons();
