import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { createServer } from "vite";
import { chromium, webkit } from "playwright";

const directory = await mkdtemp(join(tmpdir(), "outdrawn-dev-"));
let vite, server, browser, seedWorker = false;
try {
  await build({ entryPoints: ["tests/browser-fixtures.ts"], bundle: true, platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" }, outfile: join(directory, "fixtures.mjs") });
  const fixture = (await import(pathToFileURL(join(directory, "fixtures.mjs")).href)).fixtures().nested;
  vite = await createServer({ cacheDir: join(directory, "vite"), server: { middlewareMode: true, hmr: false } });
  server = createHttpServer((request, response) => {
    if (seedWorker && request.url === "/sw.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.setHeader("Cache-Control", "no-store");
      response.end(`
        self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
        self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
        self.addEventListener("fetch", event => {
          if (event.request.mode === "navigate") event.respondWith((async () => {
            const cached = await (await caches.open("outdrawn-stale-dev")).match("/");
            return cached || fetch(event.request);
          })());
        });
      `);
    } else vite.middlewares(request, response);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const engine of ["chromium", "webkit"]) {
    browser = await (engine === "chromium" ? chromium : webkit).launch(engine === "chromium"
      ? { executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {});
    const page = await browser.newPage();
    const errors = [], dependencyHeaders = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => {
      if (response.url().includes("/deps/") && response.url().includes(".js")) dependencyHeaders.push(response.headers()["cache-control"]);
    });
    await page.goto(origin);
    await page.locator(".setup-screen").waitFor();
    await page.evaluate(value => localStorage.setItem("outdrawn-match-v1", value), fixture);
    const readSave = () => page.evaluate(() => localStorage.getItem("outdrawn-match-v1"));
    for (let index = 0; index < 3; index++) {
      await page.reload();
      await page.getByRole("button", { name: "Reveal Hand", exact: true }).click();
      await page.locator(".game-log").waitFor();
      assert.equal(await readSave(), fixture);
    }
    assert(dependencyHeaders.length > 0);
    assert(dependencyHeaders.every(header => header === "no-store"));

    async function installOldWorker(staleShell) {
      seedWorker = true;
      await page.evaluate(async stale => {
        await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
        await navigator.serviceWorker.ready;
        const cache = await caches.open("outdrawn-stale-dev");
        if (stale) await cache.put("/", new Response("<html><body>Stale cached app</body></html>", { headers: { "Content-Type": "text/html" } }));
        await caches.open("unrelated-cache");
      }, staleShell);
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    }
    // The current bootstrap detaches an old worker before rendering the game.
    await installOldWorker(false);
    await page.reload();
    await page.getByRole("button", { name: "Reveal Hand", exact: true }).waitFor();
    await page.waitForFunction(() => navigator.serviceWorker.controller === null);
    assert.equal(await readSave(), fixture);

    // An old cached shell cannot run new bootstrap code. Its worker update must
    // recover it too, without clearing the match or unrelated origin caches.
    await installOldWorker(true);
    seedWorker = false;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.waitForFunction(() => navigator.serviceWorker.controller === null);
    await page.getByRole("button", { name: "Reveal Hand", exact: true }).click();
    assert.equal(await readSave(), fixture);
    assert.deepEqual(await page.evaluate(() => caches.keys()), ["unrelated-cache"]);
    assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
    await page.reload();
    await page.getByRole("button", { name: "Reveal Hand", exact: true }).click();
    await page.getByRole("button", { name: "Pass", exact: true }).click();
    assert.equal(JSON.parse(JSON.parse(await readSave()).payload).players[0].actionsRemaining, 1);
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine}: normal refresh, uncached React modules, old worker retirement, saved match preserved`);
    await browser.close(); browser = null;
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await vite?.close();
  await rm(directory, { recursive: true, force: true });
}
