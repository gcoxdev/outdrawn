import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";
import { createStaticHandler } from "./static-host.mjs";

const directory = await mkdtemp(join(tmpdir(), "outdrawn-decisions-"));
const server = createServer(createStaticHandler("dist"));
let browser;
try {
  await build({ entryPoints: ["tests/decision-fixtures.ts"], bundle: true, platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" }, outfile: join(directory, "fixtures.mjs") });
  const fixtures = (await import(pathToFileURL(join(directory, "fixtures.mjs")).href)).fixtures();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  if (process.env.DECISION_SCREENSHOTS) await mkdir("internal", { recursive: true });
  for (const engine of ["chromium", "webkit"]) {
    browser = await (engine === "chromium" ? chromium : webkit).launch(engine === "chromium"
      ? { executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {});
    const page = await browser.newPage({ hasTouch: true, reducedMotion: "reduce" });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === "outdrawn-match-v1" && sessionStorage.getItem("reject-save")) throw new DOMException("Full storage", "QuotaExceededError");
        return setItem.call(this, key, value);
      };
    });
    await page.goto(origin);
    await page.locator(".setup-screen").waitFor();
    const button = name => page.getByRole("button", { name, exact: true });
    const saved = () => page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("outdrawn-match-v1")).payload));
    async function load(name, rejectSave = false) {
      await page.evaluate(({ value, rejectSave }) => {
        sessionStorage.removeItem("reject-save");
        localStorage.setItem("outdrawn-match-v1", value);
        if (rejectSave) sessionStorage.setItem("reject-save", "1");
      }, { value: fixtures[name], rejectSave });
      await page.reload();
      await page.locator(".game-table").waitFor();
    }
    async function fits() {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${engine}: horizontal overflow`);
      assert(await page.locator(".action-panel").evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth + 1)), `${engine}: action overflow`);
    }
    async function screenshot(name, width) {
      if (process.env.DECISION_SCREENSHOTS && engine === "chromium" && [1440, 390].includes(width)) {
        await page.screenshot({ path: `internal/decision-${name}-${width}.png`, fullPage: true });
      }
    }
    for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390], [568, 320]]) {
      await page.setViewportSize({ width, height });
      const handCard = name => page.locator(`.hand-rail button:has(img[alt^="${name}:"])`);
      for (const layout of ["Tile view", "List view"]) {
        for (const [fixture, allowed, blocked] of [
          ["noCover", "Dodge", ["Pistol"]],
          ["lowAmmo", "Pistol", ["Dodge"]],
          ["intimidate", "Dodge", ["Pistol"]],
          ["reaction", "Dodge", ["Pistol", "Revive"]],
          ["secondary", "Dodge", ["Pistol", "Revive", "Ricochet"]]
        ]) {
          await load(fixture);
          await button(layout).click();
          for (const name of blocked) {
            const card = handCard(name);
            assert(await card.isDisabled(), `${fixture}: ${name} must be disabled in ${layout}`);
            await card.evaluate(element => { element.focus(); element.click(); });
            assert(!(await card.evaluate(element => element === document.activeElement)), "Disabled cards must not receive focus");
            assert.equal(await page.locator(".card-action-dialog").count(), 0, "Disabled cards must not open a dialog");
          }
          assert(await handCard(allowed).isEnabled());
          if (fixture === "reaction") assert(await handCard("Ricochet").isEnabled());
          await handCard(allowed).click();
          if (fixture === "reaction" || fixture === "secondary") {
            await button("Play Dodge").click();
            const resolved = await saved();
            assert.equal(resolved.pendingReaction, null);
            assert.equal(resolved.pendingSecondaryDamage, null);
          } else {
            assert.equal(await page.locator(".card-action-dialog").count(), 0, "Discard selection must stay in the hand");
            await button("Confirm Discard").click();
            if (fixture === "intimidate") {
              assert.equal((await saved()).pendingAttackCost, null);
              assert.equal((await saved()).pendingReaction.defenderId, "player_2");
            } else {
              // Resolve every player's discard, then ensure normal inspection returns.
              for (let player = 1; player < 3; player++) {
                assert(await handCard(blocked[0]).isDisabled());
                await handCard(allowed).click();
                await button("Confirm Discard").click();
              }
              assert.equal((await saved()).pendingDiscard, null);
              assert(await handCard(blocked[0]).isEnabled());
              await handCard(blocked[0]).click();
              await page.locator(".card-action-dialog").waitFor();
              await button("Close card").click();
            }
          }
          await fits();
        }
      }
      await load("search");
      const before = await saved();
      await page.getByRole("list", { name: "Available cards" }).getByRole("button", { name: "View Pistol card", exact: true }).click();
      await page.getByRole("dialog", { name: "Pistol card preview" }).waitFor();
      assert.deepEqual(await saved(), before, "Preview must not choose a card");
      await page.keyboard.press("Escape");
      assert(await page.getByRole("list", { name: "Available cards" }).getByRole("button", { name: "View Pistol card", exact: true }).evaluate(element => element === document.activeElement));
      await fits();
      await screenshot("search", width);
      await button("Keep Pistol").click();
      let next = await saved();
      assert.equal(next.pendingSearch, null);
      assert(next.players[0].hand.some(card => card.instanceId === before.pendingSearch.cards[0].instanceId));
      assert(before.pendingSearch.cards.slice(1).every(card => next.discardPile.some(discard => discard.instanceId === card.instanceId)));

      await load("supply");
      await button("Keep Dodge").click();
      assert.equal((await saved()).pendingSupplyDrop.currentIndex, 1);
      await button("Pass").click();
      assert.equal((await saved()).pendingSupplyDrop.currentIndex, 2);

      await load("market");
      assert(await button("Confirm Market Pick").isDisabled());
      await button("Select Pistol").click();
      assert(await button("Confirm Market Pick").isDisabled());
      await button("Select Dodge").click();
      await button("Select Bandage").click();
      assert.equal(await button("Select Pistol").getAttribute("aria-pressed"), "false");
      await fits();
      await screenshot("market", width);
      await button("Confirm Market Pick").click();
      next = await saved();
      assert.equal(next.pendingMarketSearch, null);
      assert(next.players[0].hand.some(card => card.definitionId === "healing_bandage"));
      assert(next.discardPile.some(card => card.definitionId === "weapon_pistol"));

      await load("trade");
      assert(await button("Trade").isDisabled());
      await page.locator('.hand-rail button:has(img[alt^="Pistol:"])').click();
      await fits();
      await screenshot("trade", width);
      await button("Trade").click();
      next = await saved();
      assert.equal(next.players[0].health, 18);
      assert.equal(next.players[0].hand.length, 1);
      assert.equal(next.pendingMarketSearch.cards.length, 3);

      await load("minigun");
      await page.locator('.hand-rail button:has(img[alt^="Minigun:"])').click();
      assert.equal(await page.locator(".allocation-row").count(), 99);
      assert(await page.locator(".minigun-picker__targets").evaluate(element => element.getBoundingClientRect().height <= 281));
      const search = page.getByRole("searchbox", { name: "Search opponents" });
      await search.fill("Player 100");
      await button("Add damage to Player 100").click();
      await button("Add damage to Player 100").click();
      await button("Add damage to Player 100").click();
      assert(await button("Add damage to Player 100").isDisabled());
      await search.fill("Player 99");
      for (let i = 0; i < 3; i++) await button("Add damage to Player 99").click();
      await button("Clear opponent search").click();
      assert(await button("Add damage to Player 2").isDisabled(), "Pool cannot exceed six damage");
      await button("Selected (2)").click();
      assert.equal(await page.locator(".allocation-row").count(), 2);
      await button("Clear damage from Player 99").click();
      assert.equal(await page.locator(".allocation-row").count(), 1);
      await fits();
      await screenshot("minigun", width);
      await button("Fire Minigun").click();
      next = await saved();
      assert.equal(next.players[99].health, 17);
      assert.equal(next.players[98].health, 20);

      await load("warning", true);
      await page.locator(".save-warning").waitFor();
      await page.locator(".hand-limit-warning").waitFor();
      await fits();
      await screenshot("warnings", width);
      assert(await button("End Turn").isDisabled());

      await load("base");
      await button("Open menu").click();
      await button("Return to Lobby").click();
      const confirmation = page.getByRole("dialog", { name: "Return to lobby?", exact: true });
      assert(await confirmation.locator(".match-dialog__panel").evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1;
      }));
      await screenshot("confirmation", width);
      await page.keyboard.press("Escape");
      assert.equal((await saved()).phase, "action");
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine}: restricted hand choices in tile/list views, card preview/choice separation, supply handoff, market limits/payment, 100-player Minigun allocation, warnings, confirmation layouts`);
    await browser.close(); browser = null;
  }
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
