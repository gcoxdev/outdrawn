import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";
import { createStaticHandler } from "./static-host.mjs";

const temp = await mkdtemp(join(tmpdir(), "outdrawn-revive-"));
const server = createServer(createStaticHandler("dist"));
let browser;
try {
  const outfile = join(temp, "fixtures.mjs");
  await build({ entryPoints: ["tests/revive-fixtures.ts"], outfile, bundle: true, platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" } });
  const fixtures = (await import(pathToFileURL(outfile).href)).getReviveFixtures();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const engine of (process.env.BROWSER_ENGINES ?? "chromium,webkit").split(",")) {
    browser = await (engine === "chromium" ? chromium : webkit).launch(engine === "chromium" ? { executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {});
    const page = await browser.newPage({ reducedMotion: "reduce" });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const button = name => page.getByRole("button", { name, exact: true });
    const handCard = name => page.locator(`.hand-rail button:has(img[alt^="${name}:"])`);
    const saved = () => page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("outdrawn-match-v1")).payload));
    await page.goto(origin);
    async function load(name) {
      await page.evaluate(value => localStorage.setItem("outdrawn-match-v1", value), fixtures[name]);
      await page.reload(); await page.locator(".game-table").waitFor();
    }
    async function fits() {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Horizontal overflow");
      for (const element of await page.locator(".app-dialog[open] > section, .card-action-dialog__panel").all()) {
        assert(await element.evaluate(el => el.scrollWidth <= el.clientWidth + 1), "Dialog content overflow");
      }
    }
    for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390], [568, 320]]) {
      await page.setViewportSize({ width, height });
      await load("holding");
      await handCard("Revive").click();
      assert.equal(await page.locator(".card-action-cost").innerText(), "Automatic");
      assert.match(await page.locator(".card-action-note").innerText(), /Activates automatically/);
      await page.locator('.card-action-dialog img').evaluate(image => image.decode());
      await fits();
      if (process.env.REVIVE_SCREENSHOTS) await page.screenshot({ path: `internal/revive-card-${width}.png` });
      await page.keyboard.press("Escape");
      await load("reaction");
      assert(await handCard("Revive").isDisabled(), "Passive Revive must not be selected as a reaction");
      assert.match(await page.locator(".reaction-panel").innerText(), /Revive activates automatically/);
      await button("Take Hit · Revive").click();
      assert.equal((await saved()).players[1].recovering, true);
      assert.equal((await saved()).players[1].health, 1);
      assert.deepEqual((await saved()).players[1].hand.map(c => c.definitionId), ["healing_medkit"]);
      await page.reload();
      await page.locator(".game-table").waitFor();
      assert.equal((await saved()).players[1].recovering, true);
      const mobile = width < 761 || height < 501 && width < 1101;
      if (mobile) await button("Players").click();
      assert(await page.locator('[data-player-id="player_2"] .recovery-status').isVisible());
      await fits();
      if (process.env.REVIVE_SCREENSHOTS) await page.screenshot({ path: `internal/revive-recovering-${width}.png` });
      if (mobile) await button("Table").click();
      await button("End Turn").click();
      assert.equal((await saved()).currentPlayerIndex, 1);
      assert.equal((await saved()).players[1].recovering, false);
      await handCard("Medkit").click();
      await button("Heal Blake").click();
      assert.equal((await saved()).players[1].health, 7);
      assert.equal((await saved()).players[1].actionsRemaining, 0);
      await load("event");
      await button("Draw").click();
      await button("Acknowledge").waitFor();
      assert.equal((await saved()).players[0].recovering, true);
      await page.reload();
      await button("Acknowledge").click();
      assert.equal((await saved()).currentPlayerIndex, 1);
      assert.equal((await saved()).players[0].health, 1);
      assert.deepEqual((await saved()).players[0].hand.map(c => c.definitionId), ["healing_painkillers"]);
      await fits();
      console.log(`${engine}: automatic Revive, recovery/reload, healing and event turn handoff pass ${width}x${height}`);
    }
    assert.deepEqual(errors, []);
    await browser.close(); browser = undefined;
  }
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  await rm(temp, { recursive: true, force: true });
}
