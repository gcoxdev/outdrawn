import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { createStaticHandler } from "./static-host.mjs";

const directory = await mkdtemp(join(tmpdir(), "outdrawn-backs-"));
const server = createServer(createStaticHandler("dist"));
const backs = JSON.parse(await readFile("src/data/cardBacks.json", "utf8"));
let browser;
try {
  await build({ entryPoints: ["tests/two-player-fixtures.ts"], bundle: true, platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" }, outfile: join(directory, "fixture.mjs") });
  const match = (await import(pathToFileURL(join(directory, "fixture.mjs")).href)).fixtures().immediate;
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 740 }, { width: 844, height: 390 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const open = () => page.getByRole("button", { name: "Open menu", exact: true }).filter({ visible: true }).click();
    const close = () => page.getByRole("button", { name: "Close menu", exact: true }).click();
    const choose = name => page.getByRole("radio", { name, exact: true });
    await page.goto(origin);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await open();
    assert(await choose("Classic").isChecked());
    for (const back of backs) {
      await choose(back.name).check();
      await page.locator(".menu-card-back img").evaluateAll(images => Promise.all(images.map(image => image.decode())));
      assert.equal(await page.evaluate(() => localStorage.getItem("outdrawn-card-back-v1") ?? "classic"), back.id);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    // Native radios must support keyboard changes as well as thumbnail clicks.
    await choose("Classic").focus();
    await page.keyboard.press("ArrowRight");
    assert(await choose("Shadow Target").isChecked());
    if (process.env.CARD_BACK_SCREENSHOTS) await page.screenshot({ path: `internal/card-back-menu-${viewport.width}.png` });
    await close();
    assert.match(await page.locator(".lobby-card-fan img").last().getAttribute("src"), /back-01-shadow-target/);
    await page.reload();
    await open();
    assert(await choose("Shadow Target").isChecked());
    await close();
    await page.evaluate(value => localStorage.setItem("outdrawn-match-v1", value), match);
    await page.reload();
    await page.locator('button[title="Hide hand"]').click();
    const before = await page.evaluate(() => localStorage.getItem("outdrawn-match-v1"));
    for (const back of backs) {
      await open();
      await choose(back.name).check();
      await close();
      const images = page.locator(".card-back__image");
      assert(await images.count() > 0);
      for (const image of await images.all()) {
        assert.equal(await image.getAttribute("src"), `/optimized/cards/backs/${back.file}.webp`);
        await image.evaluate(image => image.decode());
      }
      assert.equal(await page.evaluate(() => localStorage.getItem("outdrawn-match-v1")), before, "Appearance must not alter the match");
    }
    await open();
    await page.getByRole("button", { name: "Return to Lobby", exact: true }).click();
    await page.getByRole("dialog", { name: "Return to lobby?", exact: true }).getByRole("button", { name: "Return to Lobby", exact: true }).click();
    await open();
    assert(await choose("Crimson Filigree").isChecked());
    await close();
    await context.setOffline(true);
    await page.reload();
    await open();
    await page.locator(".menu-card-back img").evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await choose("Iron Sight").check();
    assert(await choose("Iron Sight").isChecked());
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${viewport.width}px: selection, keyboard, reload, live hidden cards, unchanged match, lobby return, offline images`);
  }
  for (const storageMode of ["invalid", "blocked"]) {
    const context = await browser.newContext();
    await context.addInitScript(mode => {
      if (mode === "invalid") localStorage.setItem("outdrawn-card-back-v1", "obsolete-design");
      else {
        const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
        Storage.prototype.getItem = function(key) { if (key === "outdrawn-card-back-v1") throw new Error("Storage blocked"); return get.call(this, key); };
        Storage.prototype.setItem = function(key, value) { if (key === "outdrawn-card-back-v1") throw new Error("Storage blocked"); return set.call(this, key, value); };
      }
    }, storageMode);
    const page = await context.newPage();
    await page.goto(origin);
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    assert(await page.getByRole("radio", { name: "Classic", exact: true }).isChecked());
    await page.getByRole("radio", { name: "Iron Sight", exact: true }).check();
    assert(await page.getByRole("radio", { name: "Iron Sight", exact: true }).isChecked());
    await context.close();
    console.log(`PASS ${storageMode} preference storage: safe default and usable picker`);
  }
} finally {
  await browser?.close();
  server.closeAllConnections();
  if (server.listening) await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
