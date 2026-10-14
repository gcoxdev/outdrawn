import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { mkdtemp, cp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { createStaticHandler } from "./static-host.mjs";
import { buildOffline } from "./build-offline.mjs";

const directory = await mkdtemp(join(tmpdir(), "outdrawn-browser-"));
const root = join(directory, "site");
let browser, server, page;
const errors = [];
const js = (script, ...args) => page.evaluate(({ script, args }) => new Function(script).apply(null, args), { script, args });
async function until(check, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { if (await check()) return; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error(`Timed out: ${label}`);
}
const click = selector => page.locator(selector).click();
const button = name => page.getByRole("button", { name, exact: true }).click();
const saved = () => js(`return JSON.parse(JSON.parse(localStorage.getItem('outdrawn-match-v1')).payload)`);

try {
  await cp("dist", root, { recursive: true });
  await build({ entryPoints: ["tests/browser-fixtures.ts"], bundle: true, platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" }, outfile: join(directory, "fixtures.mjs") });
  const fixtures = (await import(pathToFileURL(join(directory, "fixtures.mjs")).href)).fixtures();
  server = createServer(createStaticHandler(root));
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && !message.text().includes("favicon.ico")) errors.push(message.text()); });
  await page.goto(origin);
  await until(() => js("return !!document.querySelector('.setup-screen')"), "lobby");
  await until(() => js("return !!navigator.serviceWorker.controller"), "initial offline install", 60000);
  await click('button[aria-label="Open menu"]');
  assert.equal(await js("return !!document.activeElement.closest('dialog[open]')"), true);
  for (let index = 0; index < 12; index++) await page.keyboard.press("Tab");
  assert.equal(await js("return !!document.activeElement.closest('dialog[open]')"), true);
  await page.keyboard.press("Escape");
  await until(() => js("return !document.querySelector('dialog[open]')"), "Escape closes menu");
  assert.equal(await js("return document.activeElement.getAttribute('aria-label')"), "Open menu");

  async function loadFixture(name) {
    await js("localStorage.setItem('outdrawn-match-v1', arguments[0]);", fixtures[name]);
    await page.reload();
    await until(() => js("return !!document.querySelector('.game-table')"), name);
  }
  await loadFixture("death");
  await button("Reveal Hand");
  await button("Draw");
  await until(() => js("return !!document.querySelector('dialog.event-dialog-backdrop[open]')"), "event modal");
  await button("Acknowledge");
  await button("Reveal Hand");
  assert.equal((await saved()).currentPlayerIndex, 1);
  await button("End Turn");
  await page.reload();
  assert.equal((await saved()).currentPlayerIndex, 2);
  assert.equal(await js("return document.querySelectorAll('.hand-rail .card-view__image').length"), 0);
  console.log("PASS human elimination, continuation, pass-device privacy, and reload restoration");

  await loadFixture("bot");
  await until(async () => (await saved()).players[1].eliminated, "Master Minigun attack");
  await until(async () => (await saved()).currentPlayerIndex === 2, "bot finishes its turn");
  console.log("PASS Master bot progresses without a recovery action");

  await loadFixture("nested");
  await button("Reveal Hand");
  await click('.hand-rail button:has(img[alt^="Search:"])');
  await button("Play");
  for (const type of ["Pistol", "Dodge"]) {
    await button("Acknowledge");
    for (let player = 0; player < 3; player++) {
      if (await js("return !!document.querySelector('dialog.pass-device-gate[open]')")) await button("Reveal Hand");
      await click(`.hand-rail button:has(img[alt^="${type}:"])`);
      await button("Confirm Discard");
    }
  }
  if (await js("return !!document.querySelector('dialog.pass-device-gate[open]')")) await button("Reveal Hand");
  assert.equal((await saved()).pendingSearch.cards.length, 3);
  console.log("PASS nested Search preserves both event choices");

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await js("return document.documentElement.scrollWidth <= window.innerWidth + 1"), true);
  await js("localStorage.clear()");
  await page.reload();
  const oldTitle = await js("return document.title");
  const shell = await readFile(join(root, "index.html"), "utf8");
  await writeFile(join(root, "index.html"), shell.replace("<title>", "<title>Updated "));
  const logo = "optimized/branding/logos/outdrawn-logo-dark-01.webp";
  const oldLogo = await readFile(join(root, logo));
  await writeFile(join(root, logo), Buffer.concat([oldLogo, Buffer.from("release-b")]));
  await buildOffline(root);
  await click('button[aria-label="Open menu"]');
  await button("Check Updates");
  await until(() => js("return document.body.textContent.includes('Update downloaded and ready.')"), "release B installed", 60000);
  assert.equal(await js("return document.title"), oldTitle);
  await button("Apply Update and Reload");
  await until(() => js("return document.title.startsWith('Updated ')"), "release B activated");
  await page.context().setOffline(true);
  await page.reload();
  await until(() => js("return !!document.querySelector('.setup-screen') && document.title.startsWith('Updated ')"), "offline release B launch");
  const bytes = await page.evaluate(async logo => (await (await fetch(`/${logo}`)).arrayBuffer()).byteLength, logo);
  assert.equal(bytes, oldLogo.length + Buffer.byteLength("release-b"));
  console.log("PASS mobile layout, versioned code/art update, and offline relaunch");
  assert.deepEqual(errors, []);
  console.log("Browser smoke suite passed without browser errors.");
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
