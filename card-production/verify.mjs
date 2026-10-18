import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { outputRoot, projectRoot } from './runtime.mjs';

// Run after a complete cards:render. Compare decoded pixels so metadata and
// lossless encoder differences cannot conceal artwork/layout regressions.
const report = [];
async function verify(group, slug, publicPath) {
  const trim = resolve(outputRoot, group, 'trimmed-300dpi', slug + '.png');
  const bleed = resolve(outputRoot, group, 'bleed-300dpi', slug + '.png');
  for (const [file, width, height] of [[trim, 750, 1050], [bleed, 825, 1125]]) {
    const metadata = await sharp(file).metadata();
    assert.deepEqual([metadata.width, metadata.height, metadata.density], [width, height, 300], file);
  }
  const [actual, expected] = await Promise.all([trim, publicPath].map(path => sharp(path).ensureAlpha().raw().toBuffer()));
  const matches = actual.equals(expected);
  report.push({ group, slug, matches });
  console.log(`${matches ? 'MATCH' : 'DIFF '} ${slug}`);
}
for (const group of ['weapons', 'defense', 'ability', 'healing', 'events']) {
  const cards = JSON.parse(await readFile(new URL(`${group}/cards.json`, import.meta.url), 'utf8'));
  for (const card of cards) await verify(group, card.slug, resolve(projectRoot, `public/cards/fronts/${group}/ai-review/final/${card.slug}-dark-01.png`));
}
await verify('classic-back', 'outdrawn-back-dark-logo-01', resolve(projectRoot, 'public/cards/backs/outdrawn-back-dark-logo-01.png'));
const backs = JSON.parse(await readFile(new URL('backs/cards.json', import.meta.url), 'utf8'));
for (const card of backs) await verify('backs', card.id, resolve(projectRoot, `public/cards/backs/${card.id}.png`));
await writeFile(resolve(outputRoot, 'verification.json'), JSON.stringify({ sharp: sharp.versions, cards: report }, null, 2) + '\n');
assert.equal(report.filter(card => !card.matches).length, 0, 'Regenerated pixels differ from installed cards; review before installing');
console.log(`All ${report.length} cards match; trim, bleed, and DPI verified.`);
