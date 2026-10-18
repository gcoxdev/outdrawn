import sharp from 'sharp';
import { outputDirectory, projectRoot, installCard } from '../runtime.mjs';
import { resolve } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const variants = JSON.parse(await readFile(dir + 'cards.json', 'utf8'));
const out = await outputDirectory('backs');
for (const sub of ['revised', 'trimmed-300dpi', 'bleed-300dpi']) await mkdir(out + sub, { recursive: true });
// Layout anchors measured on the untouched 1060 × 1484 source illustrations.
// Only the surrounding frame/texture stretches; the target region keeps its
// previous uniform scale. Map each source pixel once, without mirror padding.
const layouts = {
  'back-01-shadow-target': { centerY: 718, x: [52, 60, 1000, 1008], y: [40, 62, 1360, 1388] },
  'back-02-iron-sight': { centerY: 700, x: [48, 68, 992, 1012], y: [45, 70, 1360, 1400] },
  'back-03-crimson-filigree': { centerY: 712, x: [48, 55, 1005, 1012], y: [48, 55, 1370, 1378] }
};
const targetScale = 700 / 1060;
function mapCoordinate(value, output, input) {
  let segment = 0;
  while (segment < output.length - 2 && value > output[segment + 1]) segment++;
  const t = (value - output[segment]) / (output[segment + 1] - output[segment]);
  return input[segment] + t * (input[segment + 1] - input[segment]);
}
const cards = [];
for (const variant of variants) {
  const source = dir + 'assets/' + variant.id + '.png';
  const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 1060 || info.height !== 1484) throw new Error('Re-measure layout anchors for resized source: ' + variant.id);
  const layout = layouts[variant.id];
  const xInput = [0, layout.x[0], layout.x[1], 120, 940, layout.x[2], layout.x[3], 1059];
  const yInput = [0, layout.y[0], layout.y[1], layout.centerY - 450, layout.centerY + 450, layout.y[2], layout.y[3], 1483];
  const xOutput = [-37.5, 38, 48, 375 - 410 * targetScale, 375 + 410 * targetScale, 702, 712, 787.5];
  const yOutput = [-37.5, 38, 48, 525 - 450 * targetScale, 525 + 450 * targetScale, 1002, 1012, 1087.5];
  // Sample at double resolution for the exact 37.5px bleed on every side.
  // The original outer texture covers the trim margin and bleed together.
  const width = 1650, height = 2250;
  const pixels = Buffer.alloc(width * height * 3);
  const xs = Array.from({ length: width }, (_, x) => mapCoordinate((x + .5) / 2 - 37.5, xOutput, xInput));
  for (let y = 0; y < height; y++) {
    const sy = mapCoordinate((y + .5) / 2 - 37.5, yOutput, yInput);
    const y0 = Math.floor(sy), y1 = Math.min(y0 + 1, info.height - 1), fy = sy - y0;
    for (let x = 0; x < width; x++) {
      const sx = xs[x], x0 = Math.floor(sx), x1 = Math.min(x0 + 1, info.width - 1), fx = sx - x0;
      for (let c = 0; c < 3; c++) {
        const top = data[(y0 * info.width + x0) * 3 + c] * (1 - fx) + data[(y0 * info.width + x1) * 3 + c] * fx;
        const bottom = data[(y1 * info.width + x0) * 3 + c] * (1 - fx) + data[(y1 * info.width + x1) * 3 + c] * fx;
        pixels[(y * width + x) * 3 + c] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  const working = sharp(pixels, { raw: { width, height, channels: 3 } });
  const trimmed = 'trimmed-300dpi/' + variant.id + '.png';
  const bleed = 'bleed-300dpi/' + variant.id + '.png';
  const trim = await working.clone().extract({ left: 75, top: 75, width: 1500, height: 2100 }).resize(750, 1050).withMetadata({ density: 300 }).png().toBuffer();
  await writeFile(out + trimmed, trim);
  await working.clone().resize(825, 1125).withMetadata({ density: 300 }).png().toFile(out + bleed);
  await writeFile(out + 'revised/' + variant.id + '.png', trim);
  if (process.argv.includes('--install')) await installCard(out + trimmed, resolve(projectRoot, 'public/cards/backs/' + variant.id + '.png'), out + 'previous-public/' + variant.id + '.png');
  cards.push({ id: variant.id, title: variant.title, source: 'assets/' + variant.id + '.png', revised: 'revised/' + variant.id + '.png', trimmed, bleed, targetCenter: [375, 525], targetScale, sourceAnchors: { x: xInput, y: yInput }, outputAnchors: { x: xOutput, y: yOutput } });
}
await writeFile(out + 'manifest.json', JSON.stringify({ status: process.argv.includes('--install') ? 'Installed' : 'Rendered', trim: { inches: [2.5, 3.5], pixels: [750, 1050], dpi: 300 }, bleed: { inches: [2.75, 3.75], pixels: [825, 1125], dpi: 300 }, safeInsetInches: 0.125, frameInsetPixels: 48, ornamentInsetPixels: 38, method: 'Piecewise expansion of surrounding frame and texture; fixed central target scale; no mirrored or tiled pixels.', colorSpace: 'sRGB', cards }, null, 2) + '\n');
console.log('Rendered three alternate card backs.');
