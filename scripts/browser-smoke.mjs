import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { createStaticHandler } from "./static-host.mjs";
import { buildOffline } from "./build-offline.mjs";

const directory = await mkdtemp(join(tmpdir(), "outdrawn-browser-"));
const root = join(directory, "site");
let driver, server, session;
const driverPort = Number(process.env.WEBDRIVER_PORT ?? 9516);
const driverOrigin = `http://127.0.0.1:${driverPort}`;
async function command(path, value, method = "POST") {
  const response = await fetch(driverOrigin + path, { method, headers: { "Content-Type": "application/json" }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
  const result = await response.json();
  if (result.value?.error) throw new Error(`${result.value.error}: ${result.value.message}`);
  return result.value;
}
const wd = (path, value, method) => command(`/session/${session}${path}`, value, method);
const js = (script, ...args) => wd("/execute/sync", { script, args });
async function until(check, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { if (await check()) return; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error(`Timed out: ${label}`);
}
async function click(selector) {
  const element = await wd("/element", { using: "css selector", value: selector });
  await wd(`/element/${element["element-6066-11e4-a52e-4f735466cecf"]}/click`, {});
}
async function button(text) {
  const id = await js(`const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === arguments[0] && b.getClientRects().length && !b.disabled); if (!b) throw Error('Button missing: ' + arguments[0]); b.dataset.smoke = 'target'; return true;`, text);
  assert.equal(id, true);
  await click('[data-smoke="target"]');
  await js(`document.querySelectorAll('[data-smoke]').forEach(b => delete b.dataset.smoke)`);
}
const saved = () => js(`return JSON.parse(JSON.parse(localStorage.getItem('outdrawn-match-v1')).payload)`);

try {
  await cp("dist", root, { recursive: true });
  await build({ entryPoints: ["tests/browser-fixtures.ts"], bundle: true, platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" }, outfile: join(directory, "fixtures.mjs") });
  const fixtures = (await import(pathToFileURL(join(directory, "fixtures.mjs")).href)).fixtures();
  server = createServer(createStaticHandler(root));
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  driver = spawn(process.env.CHROMEDRIVER ?? "chromedriver", [`--port=${driverPort}`], { stdio: "ignore" });
  await until(async () => (await fetch(driverOrigin + "/status")).ok, "ChromeDriver");
  const created = await command("/session", { capabilities: { alwaysMatch: {
    browserName: "chrome", "goog:chromeOptions": { binary: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1280,900"] },
    "goog:loggingPrefs": { browser: "ALL" }
  } } });
  session = created.sessionId;
  await wd("/url", { url: origin });
  await until(() => js("return !!document.querySelector('.setup-screen')"), "lobby");
  await until(() => js("return !!navigator.serviceWorker.controller"), "initial offline install", 60000);
  await click('button[aria-label="Open menu"]');
  assert.equal(await js("return !!document.activeElement.closest('dialog[open]')"), true);
  await wd("/actions", { actions: [{ type: "key", id: "tab", actions: Array.from({ length: 12 }, () => [{ type: "keyDown", value: "\uE004" }, { type: "keyUp", value: "\uE004" }]).flat() }] });
  assert.equal(await js("return !!document.activeElement.closest('dialog[open]')"), true);
  await wd("/actions", { actions: [{ type: "key", id: "keyboard", actions: [{ type: "keyDown", value: "\uE00C" }, { type: "keyUp", value: "\uE00C" }] }] });
  await until(() => js("return !document.querySelector('dialog[open]')"), "Escape closes menu");
  assert.equal(await js("return document.activeElement.getAttribute('aria-label')"), "Open menu");

  async function loadFixture(name) {
    await js("localStorage.setItem('outdrawn-match-v1', arguments[0]);", fixtures[name]);
    await wd("/refresh", {});
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
  await wd("/refresh", {});
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

  await wd("/window/rect", { width: 390, height: 844 });
  assert.equal(await js("return document.documentElement.scrollWidth <= window.innerWidth + 1"), true);
  await js("localStorage.clear()");
  await wd("/refresh", {});
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
  await wd("/goog/cdp/execute", { cmd: "Network.enable", params: {} });
  await wd("/goog/cdp/execute", { cmd: "Network.emulateNetworkConditions", params: { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 } });
  await wd("/refresh", {});
  await until(() => js("return !!document.querySelector('.setup-screen') && document.title.startsWith('Updated ')"), "offline release B launch");
  const bytes = await wd("/execute/async", { script: `const done = arguments[arguments.length - 1]; fetch('/${logo}').then(r => r.arrayBuffer()).then(b => done(b.byteLength), e => done(String(e)));`, args: [] });
  assert.equal(bytes, oldLogo.length + Buffer.byteLength("release-b"));
  console.log("PASS mobile layout, versioned code/art update, and offline relaunch");
  const logs = await wd("/log", { type: "browser" });
  const errors = logs.filter(entry => entry.level === "SEVERE" && !entry.message.includes("favicon.ico"));
  assert.deepEqual(errors, []);
  console.log("Browser smoke suite passed without browser errors.");
} finally {
  if (session) await wd("", undefined, "DELETE").catch(() => {});
  driver?.kill();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
