import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { outputRoot, projectRoot, configureFonts } from './runtime.mjs';

const groups = ['weapons', 'defense', 'ability', 'healing', 'events', 'classic-back', 'backs'];
const args = process.argv.slice(2);
for (const arg of args) {
  if (arg !== '--install' && !arg.startsWith('--group=') && !arg.startsWith('--card=')) {
    throw new Error(`Unknown option: ${arg}`);
  }
}
const group = args.find(arg => arg.startsWith('--group='))?.slice(8);
const card = args.find(arg => arg.startsWith('--card='))?.slice(7);
if (group !== undefined && !groups.includes(group)) throw new Error(`Choose --group=${groups.join('|')}`);
if (card !== undefined && (!card || !group || ['backs', 'classic-back'].includes(group))) {
  throw new Error('--card requires a front-card --group and a nonempty slug');
}
const selectedGroups = group ? [group] : groups;
const fontConfig = await configureFonts();
const exports = [];
for (const current of selectedGroups) {
  const script = fileURLToPath(new URL(`${current}/render.mjs`, import.meta.url));
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: projectRoot, stdio: 'inherit', env: { ...process.env, FONTCONFIG_FILE: fontConfig },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  const manifest = JSON.parse(await readFile(resolve(outputRoot, current, 'manifest.json'), 'utf8'));
  if (current === 'classic-back') {
    exports.push({ group: current, name: 'Classic back', trimmed: 'trimmed-300dpi/outdrawn-back-dark-logo-01.png', bleed: 'bleed-300dpi/outdrawn-back-dark-logo-01.png' });
  } else {
    exports.push(...manifest.cards.map(card => ({ ...card, group: current, name: card.name || card.title })));
  }
}
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Outdrawn card exports</title>
<style>body{background:#191719;color:#eee7dc;font:16px system-ui;margin:24px}a{color:inherit}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:24px}figure{margin:0}img{width:100%;max-width:375px;height:auto}figcaption{margin:8px 0}@page{size:letter;margin:.5in}@media print{body{background:white;color:black;margin:0}header,figcaption{display:none}main{grid-template-columns:repeat(2,2.5in);gap:.2in}figure,img{width:2.5in;height:3.5in;break-inside:avoid}}</style>
<header><h1>Outdrawn card exports</h1><p>Trim: 2.5 × 3.5 inches at 300 DPI. Bleed: 2.75 × 3.75 inches. Print this page at 100% scale for an actual-size proof.</p></header><main>${exports.map(card => `<figure><img src="${card.group}/${card.trimmed}" alt="${escape(card.name)}"><figcaption>${escape(card.name)} · <a href="${card.group}/${card.trimmed}">Trim PNG</a> · <a href="${card.group}/${card.bleed}">Bleed PNG</a></figcaption></figure>`).join('')}</main></html>`;
await writeFile(resolve(outputRoot, 'index.html'), html);
console.log(`Gallery and print proof: ${resolve(outputRoot, 'index.html')}`);
