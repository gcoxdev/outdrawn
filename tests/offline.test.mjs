import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, mkdir, cp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildOffline } from "../scripts/build-offline.mjs";
import vm from "node:vm";

async function worker() {
  const handlers = {}, entries = new Map();
  let skipped = false, deleted = false;
  const cache = { match: async key => entries.get(typeof key === "string" ? key : key.url)?.clone(),
    put: async (key, value) => { entries.set(typeof key === "string" ? key : key.url, value); } };
  const context = vm.createContext({ URL,
    self: { location: { origin: "https://app.test" }, addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: async () => { skipped = true; } },
    caches: { open: async () => cache, delete: async () => { deleted = true; } },
    fetch: async () => new Response("working")
  });
  const source = (await readFile("public/sw.js", "utf8")).replace("__BUILD_ID__", "test").replace("/* __PRECACHE__ */ []", '["/", "/assets/app.js"]');
  vm.runInContext(source, context);
  return { context, cache, handlers, status: () => ({ skipped, deleted }) };
}

test("failed installation rejects and removes its partial release", async () => {
  const w = await worker();
  w.context.fetch = async url => new Response("missing", { status: url.includes("app.js") ? 404 : 200 });
  let installing;
  w.handlers.install({ waitUntil: promise => { installing = promise; } });
  await assert.rejects(installing, /Offline asset failed/);
  assert.deepEqual(w.status(), { skipped: false, deleted: true });
});

test("installation waits for activation and cached shell survives server failure", async () => {
  const w = await worker(); let installing;
  w.handlers.install({ waitUntil: promise => { installing = promise; } });
  await installing;
  assert.equal(w.status().skipped, false);
  w.context.fetch = async () => new Response("unavailable", { status: 503 });
  const cached = await w.context.cacheFirst(new Request("https://app.test/"), "/");
  assert.equal(await cached.text(), "working");
  const failed = await w.context.cacheFirst(new Request("https://app.test/assets/missing.js"));
  assert.equal(failed.status, 503);
  assert.equal(await w.cache.match("https://app.test/assets/missing.js"), undefined);
});

test("release generation is deterministic and versions replaced artwork", async () => {
  const root = await mkdtemp(join(tmpdir(), "outdrawn-offline-"));
  try {
    await cp("public", root, { recursive: true });
    await writeFile(join(root, "index.html"), '<html><script src="/assets/app-abcdefgh.js"></script></html>');
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "assets/app-abcdefgh.js"), "console.log('app')");
    const first = await buildOffline(root);
    const again = await buildOffline(root);
    assert.equal(first.version, again.version);
    assert(first.urls.includes("/assets/app-abcdefgh.js"));
    assert(first.urls.some(url => url.includes("/final/")));
    assert(!first.urls.includes("/cards/backs/outdrawn-back-light-01.png"));
    await assert.rejects(access(join(root, "cards/backs/outdrawn-back-light-01.png")));
    const image = join(root, "branding/logos/outdrawn-logo-dark-01.png");
    await writeFile(image, Buffer.concat([await readFile(image), Buffer.from("changed")]));
    const changed = await buildOffline(root);
    assert.notEqual(changed.version, first.version);
    const manifest = JSON.parse(await readFile(join(root, "offline-assets.json"), "utf8"));
    assert.deepEqual(manifest, changed.urls);
    assert(!(await readFile(join(root, "sw.js"), "utf8")).includes("__BUILD_ID__"));
  } finally { await rm(root, { recursive: true, force: true }); }
});
