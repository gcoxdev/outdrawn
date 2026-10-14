import assert from "node:assert/strict";
import { chromium, webkit, devices } from "playwright";
import { createServer } from "node:http";
import { mkdtemp, cp, rm, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { build } from "esbuild";
import { createStaticHandler } from "./static-host.mjs";
import { buildOffline } from "./build-offline.mjs";
import { iconFiles } from "./generate-icons.mjs";

const directory = await mkdtemp(join(tmpdir(), "outdrawn-mobile-"));
let browser, server;
try {
  await build({ entryPoints: ["tests/browser-fixtures.ts"], bundle: true, platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" }, outfile: join(directory, "fixtures.mjs") });
  const fixtures = (await import(pathToFileURL(join(directory, "fixtures.mjs")).href)).fixtures();
  for (const engine of ["chromium", "webkit"]) {
    const root = join(directory, engine);
    await cp("dist", root, { recursive: true });
    const handler = createStaticHandler(root);
    let slow = engine === "chromium", nextTransfer = 0, transferred = 0;
    // Deterministic aggregate transfer budget, including worker requests. CDP page
    // throttling alone does not establish how fast a service worker downloads.
    server = createServer(async (request, response) => {
      if (slow) {
        try {
          const name = new URL(request.url, "http://localhost").pathname;
          const bytes = (await stat(join(root, name === "/" ? "index.html" : name))).size;
          transferred += bytes;
          nextTransfer = Math.max(Date.now() + 150, nextTransfer) + bytes / (500_000 / 1000);
          await delay(Math.max(0, nextTransfer - Date.now()));
        } catch {}
      }
      await handler(request, response);
    });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await (engine === "chromium" ? chromium : webkit).launch(engine === "chromium"
      ? { executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {});
    const context = await browser.newContext({ ...devices[engine === "chromium" ? "Pixel 7" : "iPhone 13"], serviceWorkers: "allow" });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const began = Date.now();
    await page.goto(origin);
    await page.locator(".setup-screen").waitFor();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 120000 });
    const installMs = Date.now() - began;
    if (slow) {
      console.log(JSON.stringify({ check: "cold-install", engine, modeledMbps: 4, latencyMs: 150, installMs, transferredBytes: transferred }));
      assert(installMs < 120000, "Cold install exceeded the two-minute modeled budget");
    }
    slow = false;
    await page.getByRole("button", { name: "Open menu", exact: true }).tap();
    assert(await page.evaluate(() => !!document.activeElement.closest("dialog[open]")));
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    assert(await page.evaluate(() => !!document.activeElement.closest("dialog[open]")));
    await page.keyboard.press("Escape");
    await page.locator("dialog[open]").waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Open menu");

    const saved = () => page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("outdrawn-match-v1")).payload));
    async function fixture(name) {
      await page.evaluate(value => localStorage.setItem("outdrawn-match-v1", value), fixtures[name]);
      await page.reload();
      await page.locator(".game-table").waitFor();
    }
    const tap = text => page.getByRole("button", { name: text, exact: true }).tap();
    await fixture("nested");
    assert.equal(await page.locator(".hand-rail .card-view__image").count(), 0);
    await tap("Reveal Hand");
    await page.locator('.hand-rail button:has(img[alt^="Search:"])').tap();
    const rules = page.locator(".selected-action-box p").first();
    await rules.scrollIntoViewIfNeeded();
    assert((await rules.innerText()).length > 20);
    assert(await rules.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return parseFloat(getComputedStyle(element).fontSize) >= 14 && rect.left >= 0 && rect.right <= innerWidth && element.scrollWidth <= element.clientWidth;
    }), "Selected card rules must fit the mobile viewport at a readable font size");
    await tap("Play Search");
    for (const type of ["Pistol", "Dodge"]) {
      await tap("Acknowledge");
      for (let player = 0; player < 3; player++) {
        if (await page.locator("dialog.pass-device-gate[open]").count()) await tap("Reveal Hand");
        await page.locator(`.hand-rail button:has(img[alt^="${type}:"])`).tap();
        await tap("Confirm Discard");
      }
    }
    if (await page.locator("dialog.pass-device-gate[open]").count()) await tap("Reveal Hand");
    assert.equal((await saved()).pendingSearch.cards.length, 3);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.reload();
    assert.equal(await page.locator(".hand-rail .card-view__image").count(), 0);
    await tap("Reveal Hand");
    assert.equal((await saved()).pendingSearch.cards.length, 3);
    await fixture("death");
    await tap("Reveal Hand"); await tap("Draw"); await tap("Acknowledge"); await tap("Reveal Hand");
    assert.equal((await saved()).currentPlayerIndex, 1);
    console.log(`PASS ${engine}: touch choices, readable rules, modal focus, privacy, nested events, reload, human elimination`);

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const title = await page.title();
    await writeFile(join(root, "index.html"), (await readFile(join(root, "index.html"), "utf8")).replace("<title>", "<title>Mobile update "));
    const logo = "optimized/branding/logos/outdrawn-logo-dark-01.webp";
    const oldLogo = await readFile(join(root, logo));
    await writeFile(join(root, logo), Buffer.concat([oldLogo, Buffer.from("mobile-release-b")]));
    await buildOffline(root);
    await page.getByRole("button", { name: "Open menu", exact: true }).tap();
    await tap("Check Updates");
    await page.getByText("Update downloaded and ready.", { exact: true }).waitFor({ timeout: 60000 });
    assert.equal(await page.title(), title);
    await tap("Apply Update and Reload");
    await page.waitForFunction(() => document.title.startsWith("Mobile update "));
    // Stop the origin as well as the browser network: an offline success cannot
    // accidentally rely on a worker bypassing browser-level offline emulation.
    await context.setOffline(true);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve)); server = undefined;
    await page.reload();
    await page.locator(".setup-screen").waitFor();
    assert((await page.title()).startsWith("Mobile update "));
    const bytes = await page.evaluate(async url => (await (await fetch(url)).arrayBuffer()).byteLength, `/${logo}`);
    assert.equal(bytes, oldLogo.length + Buffer.byteLength("mobile-release-b"));
    assert(await page.locator('img[alt="Outdrawn"]').evaluate(image => image.complete && image.naturalWidth > 0));
    const missingIcons = await page.evaluate(async paths => {
      const failures = [];
      for (const path of paths) {
        let url;
        try {
          const response = await fetch(`/${path}`);
          if (!response.ok) throw new Error("Icon unavailable offline");
          url = URL.createObjectURL(await response.blob());
          const image = new Image(); image.src = url;
          await image.decode();
          if (!image.naturalWidth) throw new Error("Icon did not decode");
        } catch { failures.push(path); }
        finally { if (url) URL.revokeObjectURL(url); }
      }
      return failures;
    }, iconFiles);
    assert.deepEqual(missingIcons, [], "All browser and installed-app icons must decode offline");
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine}: explicit code/art update, offline relaunch, and all favicon/PWA images with origin stopped`);
    await browser.close(); browser = undefined;
  }
} finally {
  await browser?.close();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await rm(directory, { recursive: true, force: true });
}
