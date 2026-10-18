// Build a separate publishable repository. Never rewrites or pushes the source.
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../', import.meta.url));
const destination = process.argv[2] && resolve(process.argv[2]);
if (!destination || process.argv.length !== 3) throw new Error('Usage: node scripts/export-slim-repository.mjs <new-directory>');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
const branch = git(source, 'symbolic-ref', '--short', 'HEAD');
const originalHead = git(source, 'rev-parse', 'HEAD');
const authorName = git(source, 'config', 'user.name');
const authorEmail = git(source, 'config', 'user.email');
const names = git(source, 'ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean);
// Snapshot only existing tracked/new nonignored files. Explicitly exclude local
// output even if an older index still tracks files there during migration.
const snapshot = [];
for (const name of new Set(names)) {
  if (/^(artifacts|local-archive|internal)\//.test(name)) continue;
  let metadata;
  try { metadata = await stat(resolve(source, name)); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  if (!metadata.isFile()) throw new Error(`Unsupported non-file entry: ${name}`);
  snapshot.push({ path: name, bytes: metadata.size, sha256: createHash('sha256').update(await readFile(resolve(source, name))).digest('hex') });
}
// mkdir without recursive deliberately refuses an existing target, including
// this checkout. Its parent must exist; no destination is ever overwritten.
await mkdir(destination);
git(destination, 'init', '-b', branch);
console.log('Importing code/document history without historical binary artwork…');
const exclusions = ['artifacts', 'public', '*.png', '*.jpg', '*.jpeg', '*.webp', '*.gif', '*.ico', '*.pdf', '*.ttf', '*.woff', '*.woff2', '*.zip'];
const exporter = spawn('git', ['fast-export', '--signed-tags=strip', '--signed-commits=strip', '--tag-of-filtered-object=drop', branch, '--', '.', ...exclusions.map(path => `:(exclude)${path}`)], { cwd: source, stdio: ['ignore', 'pipe', 'inherit'] });
const importer = spawn('git', ['fast-import', '--quiet'], { cwd: destination, stdio: ['pipe', 'ignore', 'inherit'] });
// Register completion handlers before piping; both exits must succeed.
const completed = Promise.all([once(exporter, 'close'), once(importer, 'close')]);
exporter.stdout.pipe(importer.stdin);
importer.stdin.on('error', error => { if (error.code !== 'EPIPE') console.error(error); });
const statuses = await completed;
if (statuses.some(([code]) => code !== 0)) throw new Error('History export/import failed; source repository is untouched');
// No checkout of old files: construct the final tree from the captured working
// snapshot, while preserving imported commits as the new commit's ancestors.
for (const item of snapshot) {
  const target = resolve(destination, item.path);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(source, item.path), target);
  const hash = createHash('sha256').update(await readFile(target)).digest('hex');
  if (hash !== item.sha256) throw new Error(`Source changed during export: ${item.path}; retry in a new directory`);
}
git(destination, 'add', '--all');
git(destination, '-c', `user.name=${authorName}`, '-c', `user.email=${authorEmail}`, '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'chore: preserve current card production assets', '-m', `Keep current artwork and production inputs; archive historical binaries locally.\n\nSource snapshot: ${originalHead} plus working-tree cleanup.\nHistorical commit IDs change; complete original history remains in the archive bundle.`);
const actualNames = git(destination, 'ls-files', '-z').split('\0').filter(Boolean).sort();
if (JSON.stringify(actualNames) !== JSON.stringify(snapshot.map(item => item.path).sort())) throw new Error('Exported file inventory differs from snapshot');
git(destination, 'fsck', '--full');
console.log('Packing the slim repository…');
git(destination, 'repack', '-a', '-d');
const report = {
  originalHead, exportedHead: git(destination, 'rev-parse', 'HEAD'), branch,
  destination: relative(source, destination),
  trackedBytes: snapshot.reduce((sum, item) => sum + item.bytes, 0),
  files: snapshot.length,
  historyPolicy: 'Current branch code/document history retained; historical public assets and binary files omitted. Current working files included in final commit. Source refs and history untouched. No remotes or pushes.',
  gitSize: git(destination, 'count-objects', '-vH'), snapshot,
};
await writeFile(destination + '-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Verified slim repository: ${destination}\n${report.gitSize}`);
