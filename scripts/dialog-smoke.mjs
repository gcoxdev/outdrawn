import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";
import { createStaticHandler } from "./static-host.mjs";

const directory = await mkdtemp(join(tmpdir(), "outdrawn-dialogs-"));
const server = createServer(createStaticHandler("dist"));
let browser;
try {
  await build({ entryPoints: ["tests/dialog-fixtures.ts"], bundle: true, platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" }, outfile: join(directory, "fixtures.mjs") });
  const fixtures = (await import(pathToFileURL(join(directory, "fixtures.mjs")).href)).fixtures();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  if (process.env.DIALOG_SCREENSHOTS) await mkdir("internal", { recursive: true });
  for (const engine of ["chromium", "webkit"]) {
    browser = await (engine === "chromium" ? chromium : webkit).launch(engine === "chromium"
      ? { executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {});
    const page = await browser.newPage({ hasTouch: true, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin);
    await page.locator(".setup-screen").waitFor();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const button = name => page.getByRole("button", { name, exact: true });
    const saved = () => page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("outdrawn-match-v1")).payload));
    async function load(name) {
      await page.evaluate(value => localStorage.setItem("outdrawn-match-v1", value), fixtures[name]);
      await page.reload();
      await page.locator(".game-table").waitFor();
    }
    async function fits() {
      assert(await page.locator(".match-dialog__panel").evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1 && element.scrollWidth <= element.clientWidth + 1;
      }), `${engine}: dialog outside viewport`);
      assert(await page.locator(".match-dialog__body").evaluate(element => element.scrollWidth <= element.clientWidth + 1));
      for (let index = 0; index < 8; index++) {
        await page.keyboard.press("Tab");
        // Native dialogs may yield focus to browser chrome, but never to the
        // inert game underneath. Chrome reports body during that transition.
        assert(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement.closest("dialog[open]")));
      }
    }
    async function screenshot(name, width) {
      if (process.env.DIALOG_SCREENSHOTS && engine === "chromium" && [390, 1440].includes(width)) {
        await page.locator(".match-dialog__body").evaluate(element => { element.scrollTop = 0; });
        await page.screenshot({ path: `internal/dialog-${name}-${width}.png` });
      }
    }
    for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [320, 568], [844, 390], [568, 320]]) {
      await page.setViewportSize({ width, height });
      await load("discards");
      const opener = page.locator(".log-panel__meta button");
      await opener.click();
      await fits();
      assert.equal(await page.locator(".discard-piles-list h3").first().innerText(), "Shotgun");
      await screenshot("discards", width);
      await button("View Shotgun card").click();
      await page.getByRole("dialog", { name: "Shotgun card preview" }).waitFor();
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog", { name: "Discard piles" }).count(), 1);
      assert.equal(await button("View Shotgun card").evaluate(element => element === document.activeElement), true);
      await button("Events 2").click();
      assert.equal(await page.locator(".discard-piles-list li").count(), 2);
      await page.keyboard.press("Escape");
      assert.equal(await opener.evaluate(element => element === document.activeElement), true);
      await load("event");
      await fits();
      await screenshot("event", width);
      await page.keyboard.press("Escape");
      assert((await saved()).pendingEventDialog);
      await button("Acknowledge").click();
      assert.equal((await saved()).pendingEventDialog, null);
      assert((await saved()).pendingDiscard, "Event discard choice must remain after acknowledgment");
      await load("elimination");
      await button("Take Hit").click();
      await page.getByRole("dialog", { name: "Player eliminated", exact: true }).waitFor();
      assert.equal(await page.locator(".elimination-dialog h2").innerText(), "Blake");
      assert.match(await page.locator(".elimination-dialog__remaining").innerText(), /3 players remain/);
      await fits();
      await screenshot("elimination", width);
      const beforeContinue = await saved();
      await page.waitForTimeout(700);
      assert.deepEqual(await saved(), beforeContinue, "Computer must wait for acknowledgment");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".elimination-dialog").count(), 1);
      await button("Continue").click();
      await page.waitForFunction(previous => localStorage.getItem("outdrawn-match-v1") !== previous, await page.evaluate(() => localStorage.getItem("outdrawn-match-v1")));
      assert.equal(await page.locator(".elimination-dialog").count(), 0);
      await page.reload();
      await page.locator(".game-table").waitFor();
      assert.equal(await page.locator(".elimination-dialog").count(), 0, "Reload must not replay eliminations");
      await load("finalEliminations");
      await button("End Turn").click();
      await page.getByRole("dialog", { name: "Players eliminated", exact: true }).waitFor();
      assert.equal(await page.locator(".elimination-dialog__players li").count(), 3);
      assert.equal(await page.locator(".winner-modal").count(), 0);
      await fits();
      await screenshot("elimination-group", width);
      await button("See results").click();
      await page.getByRole("dialog", { name: "Game winner" }).waitFor();
      for (const name of ["winner", "tie", "tiebreak", "team"]) {
        await load(name);
        await fits();
        await screenshot(name, width);
        if (name === "tie") assert.equal(await page.locator(".winner-modal h2").innerText(), "It's a tie");
        if (name === "tiebreak") assert.match(await page.locator(".winner-modal__description").innerText(), /Eliminations and health were tied\. Ari wins on cards in hand before the final effect: 1; .* was 0\./);
        if (name === "team") assert.equal(await page.locator(".winner-modal__team li").count(), 20);
        await button("Review table").click();
        assert.equal(await page.locator(".winner-modal").count(), 0);
        assert.equal((await saved()).phase, "gameOver");
      }
    }
    await load("eventElimination");
    await button("Reveal Hand").click();
    await button("Draw").click();
    await page.locator(".event-dialog-backdrop").waitFor();
    assert.equal(await page.locator(".elimination-dialog").count(), 0);
    await button("Acknowledge").click();
    await page.locator(".elimination-dialog").waitFor();
    assert.equal(await page.locator(".pass-device-gate").count(), 0);
    await button("Continue").click();
    await page.locator(".pass-device-gate").waitFor();
    await load("empty");
    await page.locator(".log-panel__meta button").click();
    await page.getByText("No discarded cards", { exact: true }).waitFor();
    await button("Events 0").click();
    await page.getByText("No discarded events", { exact: true }).waitFor();
    await load("crowded");
    await page.locator(".log-panel__meta button").click();
    await page.locator(".discard-piles-list li").last().scrollIntoViewIfNeeded();
    assert(await button("Close discard piles").evaluate(element => element.getBoundingClientRect().top >= 0));
    await fits();
    await load("winner");
    await page.getByRole("dialog", { name: "Game winner" }).getByRole("button", { name: "New Game", exact: true }).click();
    assert.equal((await saved()).phase, "action");
    assert.equal((await saved()).round, 1);
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine}: discards, events, eliminations, bot pause/resume, reload, privacy, victory/tie/team dialogs, focus, short screens, restart`);
    await browser.close(); browser = null;
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
