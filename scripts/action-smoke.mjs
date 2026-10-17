import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";
import { createStaticHandler } from "./static-host.mjs";

const directory = await mkdtemp(join(tmpdir(), "outdrawn-actions-"));
const server = createServer(createStaticHandler("dist"));
let browser;
try {
  await build({ entryPoints: ["tests/action-fixtures.ts"], bundle: true, platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" }, outfile: join(directory, "fixtures.mjs") });
  const fixtures = (await import(pathToFileURL(join(directory, "fixtures.mjs")).href)).fixtures();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  if (process.env.ACTION_SCREENSHOTS) await mkdir("internal", { recursive: true });
  for (const engine of ["chromium", "webkit"]) {
    browser = await (engine === "chromium" ? chromium : webkit).launch(engine === "chromium" ? { executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {});
    const page = await browser.newPage({ hasTouch: true, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      const fixture = sessionStorage.getItem("action-fixture");
      if (fixture) { localStorage.setItem("outdrawn-match-v1", fixture); sessionStorage.removeItem("action-fixture"); }
    });
    await page.goto(origin);
    const button = name => page.getByRole("button", { name, exact: true });
    const saved = () => page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("outdrawn-match-v1")).payload));
    const selectCard = async name => {
      if (await page.locator(".card-action-dialog").count()) await button("Close card").click();
      await page.locator(`.hand-rail button:has(img[alt^="${name}:"])`).click();
    };
    async function load(name) {
      await page.evaluate(value => sessionStorage.setItem("action-fixture", value), fixtures[name]);
      await page.reload();
      await page.locator(".game-table").waitFor();
    }
    async function choose(name, seat, recipient = false) {
      await button(recipient ? "Choose recipient" : "Choose target").click();
      await button(`Select ${name}, seat ${seat}`).click();
    }
    async function fits() {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${engine}: page overflow`);
      assert(await page.locator(".action-panel").evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth + 1)), `${engine}: action overflow`);
      for (const dialog of await page.locator(".target-dialog__panel, .card-action-dialog__panel").all()) {
        const bounds = await dialog.boundingBox();
        const viewport = page.viewportSize();
        assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1, `${engine}: dialog bounds`);
        assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `${engine}: dialog overflow`);
      }
    }
    async function shot(name, width) {
      if (process.env.ACTION_SCREENSHOTS && engine === "chromium" && [1440, 390].includes(width)) await page.screenshot({ path: `internal/action-${name}-${width}.png`, fullPage: true });
    }
    for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
      await page.setViewportSize({ width, height });
      for (const fixture of ["soloHealing", "lastTeammate", "teamHealingDisabled"]) {
        await load(fixture);
        await selectCard("Bandage");
        assert.equal(await button("Choose target").count(), 0, `${fixture}: self-only healing needs no picker`);
        assert(await button("Heal Ari").isEnabled());
        await fits();
        const beforeHealing = await saved();
        await button("Heal Ari").click();
        const afterHealing = await saved();
        assert.equal(afterHealing.players[0].health, beforeHealing.players[0].health + 3);
        assert.equal(afterHealing.players[0].actionsRemaining, beforeHealing.players[0].actionsRemaining - 1);
        assert.equal(afterHealing.players[1].health, beforeHealing.players[1].health);
      }
      await load("exhaustedOptions");
      for (const name of ["Pistol", "Bandage", "Mark Target", "Adrenaline", "Minigun", "Steal"]) {
        await selectCard(name);
        assert.match(await page.locator(".card-action-panel [role=status]").innerText(), /No actions left/);
        assert.equal(await page.locator(".card-action-panel .target-picker, .card-action-panel .minigun-picker, .card-action-panel .decision-primary").count(), 0, `${name}: exhausted players must not be offered play choices`);
        assert(await button("Transfer").isDisabled());
        assert(await button("Discard").isEnabled());
        await fits();
      }
      await shot("no-actions", width);
      await load("oneAction");
      await selectCard("Medkit");
      assert.match(await page.locator(".card-action-panel [role=status]").innerText(), /You need 2 actions.*You have 1 left/);
      assert.equal(await button("Choose target").count(), 0);
      assert(await button("Transfer").isEnabled(), "A two-action card can still be transferred for one action");
      await button("Transfer").click();
      assert.equal(await button("Choose recipient").count(), 0);
      assert(await button("Give to Blake").isEnabled());
      await button("Cancel transfer").click();
      assert.equal(await button("Choose target").count(), 0);
      await load("redirect");
      async function redirectFits() {
        const picker = await button("Choose target").boundingBox();
        const submit = await page.locator(".redirect-action > button").boundingBox();
        if (width > 760) {
          assert(Math.abs(picker.y - submit.y) <= 1, "Redirect controls must align at the top");
          assert(Math.abs(picker.height - submit.height) <= 1, "Redirect controls must have equal height");
        }
        await fits();
      }
      await redirectFits();
      await choose("Casey", 3);
      await redirectFits();
      await shot("redirect", width);
      assert(await button("Redirect to Casey").isEnabled(), "Ricochet does not require turn actions");
      await button("Redirect to Casey").click();
      assert.equal((await saved()).pendingRedirect, null);
      await load("crowded");
      assert(await page.locator(".current-board").evaluate(element => element.scrollHeight > element.clientHeight), "Large hands must scroll");
      const toolbar = await page.locator(".turn-toolbar").boundingBox();
      assert(toolbar.y + toolbar.height <= height, "Turn controls must fit within the screen");
      await page.locator(".current-board").evaluate(element => { element.scrollTop = element.scrollHeight; });
      assert.deepEqual(await page.locator(".turn-toolbar").boundingBox(), toolbar, "Scrolling cards must not move turn controls");
      await load("base");
      await selectCard("Pistol");
      assert(await button("Attack").isDisabled());
      const before = await saved();
      await choose("Blake", 2);
      assert.deepEqual(await saved(), before, "Choosing a target must not play a card");
      await fits();
      await shot("selected", width);
      assert(await button("Attack Blake").evaluate(element => ["rgb(183, 70, 57)", "rgb(203, 82, 66)"].includes(getComputedStyle(element).backgroundColor)), "Primary attack must remain emphasized on touch screens");
      assert(await page.locator(".card-action-dialog__art img").isVisible());
      const art = await page.locator(".card-action-dialog__art").boundingBox();
      const actions = await page.locator(".card-action-dialog .action-panel").boundingBox();
      if (width > 600) {
        assert(Math.abs(art.y - actions.y) <= 1 && Math.abs(actions.x - art.x - art.width - 20) <= 1, "Desktop card and actions must share a row with a clear gap");
      } else {
        assert(Math.abs(actions.y - art.y - art.height - 20) <= 1, "Stacked mobile card and actions need 20px of separation");
      }
      assert.equal(await page.locator(".hand-inspect").count(), 0);
      await page.keyboard.press("Escape");
      assert(await page.locator('.hand-rail button:has(img[alt^="Pistol:"])').evaluate(element => element === document.activeElement));
      await selectCard("Mark Target");
      assert(await button("Play Mark Target").isDisabled(), "Switching cards must clear the prior target");
      await choose("Casey", 3);
      await button("Play Mark Target on Casey").click();
      assert.equal((await saved()).markedTargets.player_3, 1);
      await selectCard("Pistol");
      await choose("Blake", 2);
      await button("Attack Blake").click();
      assert.equal((await saved()).pendingReaction.defenderId, "player_2");
      await selectCard("Dodge");
      await button("Play Dodge").click();
      assert.equal((await saved()).pendingReaction, null);

      await load("teams");
      await selectCard("Bandage");
      assert(await button("Heal Ari").isDisabled());
      await choose("Blake", 2);
      await button("Heal Blake").click();
      assert((await saved()).players[1].health > JSON.parse(JSON.parse(fixtures.teams).payload).players[1].health);
      await selectCard("Pistol");
      assert.equal(await button("Choose recipient").count(), 0);
      await button("Transfer").click();
      await fits();
      assert.equal(await button("Choose recipient").count(), 0);
      const preTransfer = await saved();
      await button("Give to Blake").click();
      const transferred = await saved();
      assert.equal(transferred.players[1].hand.length, preTransfer.players[1].hand.length + 1);
      assert.equal(transferred.players[0].actionsRemaining, preTransfer.players[0].actionsRemaining - 1);

      await load("smoke");
      await selectCard("Pistol");
      await button("Choose target").click();
      assert(await button("Select Blake, seat 2").isDisabled());
      assert((await button("Select Blake, seat 2").textContent()).includes("Smoke Bomb"));
      await fits();
      await page.keyboard.press("Escape");
      assert(await button("Choose target").evaluate(element => element === document.activeElement), "Restore focus after dismissing picker");
      await selectCard("Minigun");
      assert(await button("Add damage to Blake").isDisabled());
      assert(await button("Fire Minigun").isDisabled());
      await fits();

      await load("large");
      await selectCard("Pistol");
      await button("Choose target").click();
      assert.equal(await page.locator(".target-option").count(), 99);
      assert(await page.locator(".target-dialog__body").evaluate(element => element.scrollHeight > element.clientHeight), "Large roster must scroll within picker");
      await fits();
      await shot("picker", width);
      await button("Close target picker").focus();
      await page.keyboard.press("Tab");
      assert(await page.getByRole("searchbox", { name: "Search targets" }).evaluate(element => element === document.activeElement), "Search must be keyboard accessible");
      await page.keyboard.press("Tab");
      assert(await page.evaluate(() => !!document.activeElement?.closest(".target-options")), "Targets must be keyboard accessible");
      await page.getByRole("searchbox", { name: "Search targets" }).fill("Player 100");
      assert.equal(await page.locator(".target-option").count(), 1);
      await button("Select Player 100, seat 100").click();
      assert(await button("Attack Player 100").isEnabled());
      await fits();
      console.log(`${engine}: card actions at ${width}×${height} passed`);
    }
    await load("soloHealing");
    for (const name of ["Bandage", "Medkit", "Painkillers", "Field Dressing"]) {
      await selectCard(name);
      assert.equal(await button("Choose target").count(), 0);
      assert(await button("Heal Ari").isEnabled());
    }
    await load("fullHealth");
    await selectCard("Bandage");
    assert.equal(await button("Choose target").count(), 0);
    assert(await button("Heal Ari").isDisabled());
    assert.equal(await page.locator(".card-action-panel [role=status]").innerText(), "Already at full health");
    await selectCard("Painkillers");
    assert(await button("Heal Ari").isEnabled(), "Painkillers can still be used to draw at full health");
    await button("Heal Ari").click();
    assert.equal((await saved()).players[0].health, 20);
    assert((await saved()).players[0].hand.some(card => card.definitionId === "weapon_pistol"));
    await load("multipleTeammates");
    await selectCard("Pistol");
    await button("Transfer").click();
    assert(await button("Choose recipient").isEnabled());
    assert(await button("Give card").isDisabled());
    await choose("Casey", 3, true);
    await button("Give to Casey").click();
    assert.equal((await saved()).players[2].hand.length, 2);
    await load("noCost");
    await selectCard("Pistol");
    await button("Choose target").click();
    assert(await button("Select Blake, seat 2").isDisabled());
    assert((await button("Select Blake, seat 2").textContent()).includes("Intimidate"));
    await page.keyboard.press("Escape");
    await load("intimidate");
    await selectCard("Pistol");
    await choose("Blake", 2);
    await button("Attack Blake").click();
    assert.equal((await saved()).pendingAttackCost.targetPlayerId, "player_2");
    await selectCard("Dodge");
    await button("Confirm Discard").click();
    assert.equal((await saved()).pendingReaction.defenderId, "player_2");
    await load("exhausted");
    await selectCard("Pistol");
    assert.equal(await button("Choose target").count(), 0);
    assert.match(await page.locator(".card-action-panel [role=status]").innerText(), /No actions left/);
    await button("Discard").click();
    await page.waitForFunction(() => document.activeElement?.classList.contains("hand-rail"));
    assert.equal((await saved()).players[0].hand.length, 3);
    assert.equal((await saved()).players[0].actionsRemaining, 0);
    await load("exhaustedReaction");
    await selectCard("Dodge");
    await button("Play Dodge").click();
    assert.equal((await saved()).pendingReaction, null);
    assert.equal((await saved()).players[1].actionsRemaining, 0);
    await load("redirect");
    await choose("Casey", 3);
    assert((await saved()).pendingRedirect, "Choosing redirect target must not commit");
    await button("Redirect to Casey").click();
    assert.equal((await saved()).pendingRedirect, null);
    await load("base");
    await selectCard("Adrenaline");
    const preAdrenaline = await saved();
    await button("Play Adrenaline").click();
    assert((await saved()).players[0].actionsRemaining > preAdrenaline.players[0].actionsRemaining);
    assert.deepEqual(errors, []);
    await browser.close(); browser = undefined;
  }
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
