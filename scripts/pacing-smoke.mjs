import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";
import { createStaticHandler } from "./static-host.mjs";

const temp = await mkdtemp(join(tmpdir(), "outdrawn-pacing-"));
const server = createServer(createStaticHandler("dist"));
let browser;
try {
  const outfile = join(temp, "fixtures.mjs");
  await build({ entryPoints: ["tests/pacing-fixtures.ts"], outfile, bundle: true, platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" } });
  const fixtures = (await import(pathToFileURL(outfile).href)).getPacingFixtures();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const engine of (process.env.BROWSER_ENGINES ?? "chromium,webkit").split(",")) {
    browser = await (engine === "chromium" ? chromium : webkit).launch(engine === "chromium" ? { executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {});
    const page = await browser.newPage({ reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const button = name => page.getByRole("button", { name, exact: true });
    const recap = page.getByRole("region", { name: "Computer turn recap", exact: true });
    const saved = () => page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("outdrawn-match-v1")).payload));
    await page.goto(origin);
    async function load(name, mobile = false) {
      await page.evaluate(value => localStorage.setItem("outdrawn-match-v1", value), fixtures[name]);
      await page.reload();
      await page.locator(".game-table").waitFor();
      if (mobile) await button("Players").click();
    }
    async function skip() {
      await button("Skip to next decision").click();
      await recap.getByRole("button", { name: "Continue", exact: true }).waitFor();
    }
    for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390], [568, 320]]) {
      await page.setViewportSize({ width, height });
      await load("large", width < 1024);
      const before = Date.now();
      await skip();
      assert(Date.now() - before < 8000, "Skip must bypass per-decision delays");
      assert.equal((await saved()).currentPlayerIndex, 99);
      assert.match(await recap.innerText(), /No eliminations/);
      assert.match(await recap.innerText(), /No damage to human players/);
      assert(await recap.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight;
      }), `Recap outside ${width}x${height}`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (width < 1024) {
        await button("Log").click();
        assert(await recap.isVisible(), "Recap must remain available on the log tab");
      }
      if (process.env.PACING_SCREENSHOTS) await page.screenshot({ path: `internal/pacing-${width}.png` });
      await recap.getByRole("button", { name: "Continue", exact: true }).click();
      await recap.waitFor({ state: "detached" });
      console.log(`${engine}: pacing and recap fit ${width}x${height}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await load("event");
    await skip();
    assert.equal((await saved()).pendingEventDialog.card.definitionId, "event_pressure_zone");
    assert.match(await recap.innerText(), /Player 3: 1 damage taken/);
    assert.match(await recap.innerText(), /Events: Pressure Zone/);
    assert(await page.getByRole("dialog").isVisible());
    await load("finish");
    await skip();
    assert.equal((await saved()).phase, "gameOver");
    assert.match(await recap.innerText(), /Events: Pressure Zone/);
    assert.match(await recap.innerText(), /Eliminated: Player 1, Player 2, Player 3/);
    await load("attack");
    await skip();
    assert.equal((await saved()).pendingReaction.defenderId, "player_2");
    await load("handoff");
    await skip();
    assert(await button("Reveal Hand").isVisible(), "Skipping must not reveal the next human hand");
    await load("elimination");
    await skip();
    assert.match(await recap.innerText(), /Eliminated: Player 1/);
    assert(await page.getByRole("dialog").isVisible());
    // Stop in the same browser task as starting; no automated work may follow.
    await load("large");
    await button("Skip to next decision").evaluate(element => {
      element.click();
      const observer = new MutationObserver(() => {
        const stop = document.querySelector(".computer-recap button");
        if (stop?.textContent === "Stop skipping") { stop.click(); observer.disconnect(); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    await recap.getByRole("button", { name: "Continue", exact: true }).waitFor();
    const stopped = await saved();
    await page.waitForTimeout(650);
    assert.deepEqual(await saved(), stopped, "Computer turns wait for recap dismissal after stopping");
    await load("large");
    await button("Skip to next decision").evaluate(element => {
      element.click();
      const observer = new MutationObserver(() => {
        const summary = document.querySelector(".computer-recap");
        if (summary?.textContent.includes("20 decisions")) {
          document.querySelector('button[aria-label="Open menu"]').click();
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    });
    await page.getByRole("dialog", { name: "Game menu", exact: true }).waitFor();
    await recap.getByRole("button", { name: "Continue", exact: true }).waitFor();
    const interrupted = await saved();
    await button("Close menu").click();
    await page.waitForTimeout(650);
    assert.deepEqual(await saved(), interrupted, "Opening and closing a reference stops skipping until recap dismissal");
    await page.reload();
    await recap.waitFor({ state: "detached" });
    await button("Open menu").click();
    await page.getByRole("tab", { name: "Cards", exact: true }).click();
    for (const name of ["Ricochet", "Revive", "Scavenge"]) {
      await page.getByRole("searchbox", { name: "Search cards", exact: true }).fill(name);
      await page.getByRole("button", { name: `View ${name} card`, exact: true }).click();
      const preview = page.getByRole("dialog", { name: `${name} card preview`, exact: true });
      await preview.locator("img").evaluate(image => image.decode());
      await page.keyboard.press("Escape");
    }
    assert.deepEqual(errors, []);
    await browser.close();
    browser = undefined;
    console.log(`${engine}: event, defense, handoff, elimination, stop, reload and renamed artwork checks passed`);
  }
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  await rm(temp, { recursive: true, force: true });
}
