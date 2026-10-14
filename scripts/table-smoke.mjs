import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";
import { createStaticHandler } from "./static-host.mjs";

const directory = await mkdtemp(join(tmpdir(), "outdrawn-table-"));
const server = createServer(createStaticHandler("dist"));
let browser;
try {
  await build({ entryPoints: ["tests/table-fixtures.ts"], bundle: true, platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" }, outfile: join(directory, "fixtures.mjs") });
  const fixtures = (await import(pathToFileURL(join(directory, "fixtures.mjs")).href)).fixtures();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  if (process.env.TABLE_SCREENSHOTS) await mkdir("internal", { recursive: true });
  for (const engine of ["chromium", "webkit"]) {
    browser = await (engine === "chromium" ? chromium : webkit).launch(engine === "chromium"
      ? { executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {});
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin);
    await page.locator(".setup-screen").waitFor();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const saved = () => page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("outdrawn-match-v1")).payload));
    const button = name => page.getByRole("button", { name, exact: true });
    const card = name => page.locator(`.hand-rail button:has(img[alt^="${name}:"])`);
    async function load(name) {
      await page.evaluate(value => localStorage.setItem("outdrawn-match-v1", value), fixtures[name]);
      await page.reload();
      await page.locator(".game-table").waitFor();
    }
    async function fits() {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${engine}: page overflows horizontally`);
      assert(await page.locator(".decision-workspace").evaluate(element => element.scrollWidth <= element.clientWidth + 1), `${engine}: play area overflows horizontally`);
    }
    async function screenshot(name) {
      if (process.env.TABLE_SCREENSHOTS && engine === "chromium") await page.screenshot({ path: `internal/game-${name}.png`, fullPage: true });
    }
    for (const [width, height] of [[1440, 900], [1920, 1080], [1024, 768], [768, 1024], [760, 800], [390, 844], [320, 740], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await load("table");
      await fits();
      if (width === 1440) await screenshot("desktop");
      if (width === 390) await screenshot("mobile");
      await card("Pistol").tap();
      await fits();
      if (width === 1440) await screenshot("attack-desktop");
      if (width === 390) await screenshot("attack-mobile");
      await button("Choose target").tap();
      await button("Select Blake, seat 2").tap();
      await button("Attack Blake").tap();
      assert.equal((await saved()).pendingReaction.defenderId, "player_2");
      await card("Dodge").tap();
      await button("Play Dodge").tap();
      assert.equal((await saved()).pendingReaction, null);
      if (width <= 760) {
        await button("Players").tap();
        await page.locator(".player-roster").waitFor();
        assert.equal(await page.locator(".decision-workspace").isVisible(), false);
        await button("Log").tap();
        await page.locator(".game-log").waitFor();
        await page.getByRole("textbox", { name: "Search", exact: true }).fill("Dodge");
        assert((await page.locator(".game-log ol").innerText()).includes("Dodge"));
        await button("Table").tap();
        assert.equal(await button("Table").getAttribute("aria-pressed"), "true");
      }
      await button("Open menu").tap();
      await button("Close menu").tap();
      await page.locator(".log-panel__meta button").tap();
      await page.getByRole("dialog", { name: "Discard piles" }).waitFor();
      await button("Close discard piles").tap();
    }
    for (const name of ["crowded", "team"]) {
      for (const width of [320, 760, 1024, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        await load(name);
        await fits();
        if (name === "team") {
          const selector = await page.locator(".board-heading select").boundingBox();
          const privacy = await button("Hide Ari's hand").boundingBox();
          const toggle = await page.getByRole("group", { name: "Hand display" }).boundingBox();
          assert(Math.abs(selector.y - privacy.y) <= 1 && Math.abs(toggle.y - privacy.y) <= 1, "Hand controls must align at the top");
          assert(Math.abs(selector.height - privacy.height) <= 1 && Math.abs(toggle.height - privacy.height) <= 1, "Hand controls must have equal height");
          await button("List view").click();
          assert.equal(await page.locator(".hand-list-card").count(), 5);
          await button("Open Pistol card").click();
          assert(await page.getByRole("dialog", { name: "Pistol card", exact: true }).isVisible());
          await button("Close card").click();
          assert(await button("Open Pistol card").evaluate(element => element === document.activeElement));
          await button("Hide Ari's hand").click();
          assert.equal(await page.locator(".hand-list-card__copy").count(), 0, "Hidden list must not expose card details");
          assert.equal(await page.locator(".hand-list-card--hidden").count(), 5);
          await button("Show Ari's hand").click();
          await page.locator(".board-heading select").selectOption("player_2");
          await button("Open Dodge card").click();
          assert.equal(await button("Discard").count(), 0, "Teammate cards are inspection only");
          await button("Close card").click();
          await fits();
          if (width === 1440 || width === 320) await screenshot(`team-list-${width}`);
          await button("Tile view").click();
          assert.equal(await page.locator(".hand-rail .card-view").count(), 1);
          await fits();
        } else {
          await button("List view").click();
          await button("Select Pistol card").last().click();
          assert.equal(await page.locator(".card-action-dialog").count(), 0, "Discard selection stays in the hand");
          assert.equal(await button("Select Pistol card").last().getAttribute("aria-pressed"), "true");
          await button("Tile view").click();
          const limit = (await saved()).settings.maxHandSize;
          for (let index = 0; index < 12 - limit - 1; index++) await card("Pistol").nth(index).tap();
          await button("Discard Selected").tap();
          assert.equal((await saved()).players[0].hand.length, limit);
          if (width <= 760) await button("Players").tap();
          await page.locator(".player-roster-card").last().scrollIntoViewIfNeeded();
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        }
      }
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine}: responsive table, attack/defense, navigation, discards, 100 players, large hand, team viewing`);
    await browser.close(); browser = null;
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
