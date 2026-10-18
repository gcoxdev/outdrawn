import { copyFile, mkdir, access, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const outputRoot = resolve(projectRoot, 'artifacts/card-production');

// Font files alone do not fix rasterization: Fontconfig normally inherits the
// desktop's hinting defaults. Pin the approved settings and restrict discovery
// to the bundled fonts, using a writable cache beside the ignored exports.
export async function configureFonts() {
  const cache = resolve(outputRoot, 'font-cache');
  await mkdir(cache, { recursive: true });
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const config = resolve(outputRoot, 'fonts.conf');
  await writeFile(config, `<?xml version="1.0"?>
<fontconfig>
  <dir>${escape(fileURLToPath(new URL('fonts', import.meta.url)))}</dir>
  <cachedir>${escape(cache)}</cachedir>
  <match target="pattern">
    <edit name="hintstyle" mode="assign"><const>hintslight</const></edit>
    <edit name="antialias" mode="assign"><bool>true</bool></edit>
    <edit name="lcdfilter" mode="assign"><const>lcddefault</const></edit>
  </match>
</fontconfig>\n`);
  return config;
}

export async function outputDirectory(group) {
  const directory = resolve(outputRoot, group);
  await mkdir(directory, { recursive: true });
  return directory + sep;
}

const fonts = {
  'Noto Sans Black': 'NotoSans-Black.ttf',
  'Noto Sans Condensed Bold': 'NotoSans-Bold.ttf',
  'DejaVu Sans Bold': 'DejaVuSans-Bold.ttf',
  'Liberation Serif Bold': 'LiberationSerif-Bold.ttf',
  'Liberation Serif Bold Italic': 'LiberationSerif-BoldItalic.ttf',
};

export function fontFile(font) {
  if (!fonts[font]) throw new Error(`Unbundled font: ${font}`);
  return fileURLToPath(new URL(`fonts/${fonts[font]}`, import.meta.url));
}

export async function installCard(source, destination, backup) {
  await mkdir(dirname(destination), { recursive: true });
  try {
    await access(backup);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(dirname(backup), { recursive: true });
    try { await copyFile(destination, backup); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await copyFile(source, destination);
}
