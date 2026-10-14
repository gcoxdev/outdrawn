import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";
import { createStaticHandler } from "./static-host.mjs";

const directory = await mkdtemp(join(tmpdir(), "outdrawn-assessment-"));
const server = createServer(createStaticHandler("dist"));
let browser;
try {
  await build({ entryPoints: ["tests/assessment-fixtures.ts"], bundle: true, platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" }, outfile: join(directory, "fixtures.mjs") });
  const fixtures = (await import(pathToFileURL(join(directory, "fixtures.mjs")).href)).fixtures();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const engine of ["chromium", "webkit"]) {
    browser = await (engine === "chromium" ? chromium : webkit).launch(engine === "chromium" ? { executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {});
    const page = await browser.newPage({ reducedMotion: "reduce" });
    page.setDefaultTimeout(10000);
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      const raw = sessionStorage.getItem("assessment-fixture");
      if (raw !== null) {
        localStorage.setItem("outdrawn-match-v1", raw);
        sessionStorage.removeItem("assessment-fixture");
      }
    });
    await page.goto(origin);
    await page.locator(".setup-screen").waitFor();
    const button = name => page.getByRole("button", { name, exact: true });
    const saved = () => page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("outdrawn-match-v1")).payload));
    const load = async name => {
      await page.evaluate(raw => sessionStorage.setItem("assessment-fixture", raw), fixtures[name]);
      await page.reload();
      try { await page.locator(name === "invalid" ? ".match-recovery" : ".game-table").waitFor(); }
      catch (error) { throw new Error(`${engine}, fixture ${name}: ${await page.locator("body").innerText()}`, { cause: error }); }
    };
    const contrast = async selector => {
      const ratios = await page.locator(selector).evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => {
        const rgba = color => (color.match(/[\d.]+/g) ?? []).map(Number);
        const blend = (fg, bg) => fg.slice(0, 3).map((channel, i) => channel * (fg[3] ?? 1) + bg[i] * (1 - (fg[3] ?? 1)));
        const ancestors = []; for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
        const background = ancestors.reduce((color, node) => blend(rgba(getComputedStyle(node).backgroundColor), color), [0, 0, 0]);
        const foreground = blend(rgba(getComputedStyle(element).color), background);
        const luminance = rgb => rgb.map(channel => { const c = channel / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
        const a = luminance(foreground), b = luminance(background);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      }));
      assert(ratios.length && ratios.every(ratio => ratio >= 4.5), `${engine}: text contrast below 4.5 for ${selector}: ${ratios}`);
    };
    const fits = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${engine}: page overflow`);
    for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await load("reaction");
      const before = await saved();
      await button("View Dodge card").click();
      const preview = page.getByRole("dialog", { name: "Dodge card preview" });
      await preview.waitFor();
      assert(await preview.locator(".card-preview-rules").isVisible());
      await contrast(".card-preview-rules");
      await fits();
      await page.keyboard.press("Escape");
      assert(await button("View Dodge card").evaluate(el => el === document.activeElement));
      assert.deepEqual(await saved(), before);
      await page.locator(".hand-rail .card-view").filter({ has: page.getByAltText(/^Dodge:/) }).click();
      await page.locator(".reaction-rules").waitFor();
      await contrast(".reaction-rules p, .hand-inspect");
      if (process.env.ASSESSMENT_SCREENSHOTS && engine === "chromium") await page.screenshot({ path: `internal/followup-reaction-${width}.png`, fullPage: true });
      await button("Play Dodge").click();
      assert.equal((await saved()).pendingReaction, null);
      await load("result");
      assert(await page.getByText("Tiebreak victory", { exact: true }).isVisible());
      await button("Review table").click();
      await button("View result").click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      assert(await button("View result").evaluate(el => el === document.activeElement));
      assert.equal(await page.getByText(/is choosing|is resolving this decision/).count(), 0);
      await button("Review log").click();
      assert(await page.locator(".game-log").isVisible());
      await fits();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await load("roster");
    await button("Players").click();
    await page.getByLabel("Search players", { exact: true }).fill("Player 100");
    assert.equal(await page.locator(".player-roster-card").count(), 1);
    await page.getByLabel("Player group", { exact: true }).selectOption("living");
    assert.equal(await page.locator(".player-roster-card").count(), 0);
    await button("Find active player").click();
    assert(await page.locator(".player-roster-card.is-decision").evaluate(el => el === document.activeElement));
    await page.getByLabel("Player group", { exact: true }).selectOption("team_2");
    assert.equal(await page.locator(".player-roster-card").count(), 25);
    await fits();
    await contrast(".roster-filters input, .roster-filters select, .roster-filters button");

    await load("bots");
    await button("Pause computers").click();
    const paused = await saved();
    await page.waitForTimeout(650);
    assert.deepEqual(await saved(), paused);
    await button("Open menu").click();
    await page.getByRole("dialog", { name: "Game menu" }).getByText("Computers paused", { exact: true }).waitFor();
    await button("Close menu").click();
    await page.getByLabel("Computer speed").selectOption("150");
    await button("Resume computers").click();
    await button("Open menu").click();
    const reading = await saved();
    await page.waitForTimeout(700);
    assert.deepEqual(await saved(), reading, "Reference reading pauses automation");
    await button("Close menu").click();
    await page.waitForFunction(previous => JSON.parse(JSON.parse(localStorage.getItem("outdrawn-match-v1")).payload).log.length > previous, reading.log.length);

    await page.setViewportSize({ width: 1280, height: 900 });
    await load("reaction");
    await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
    await button("View Dodge card").click();
    await page.getByRole("dialog", { name: "Dodge card preview" }).waitFor();
    await fits();
    await page.keyboard.press("Tab");
    // A native dialog with one focusable control may tab to browser chrome (body).
    // It must never move focus to the inert game behind the preview.
    assert(await page.evaluate(() => !document.activeElement.closest("#root")), "Zoomed preview keeps background controls inert");
    await page.keyboard.press("Shift+Tab");
    assert(await page.evaluate(() => document.querySelector("dialog[open]").contains(document.activeElement)), "Keyboard focus returns to the preview");
    await page.keyboard.press("Escape");
    await page.evaluate(() => { document.documentElement.style.zoom = ""; });
    await load("invalid");
    assert.equal(await page.evaluate(() => localStorage.getItem("outdrawn-match-v1")), fixtures.invalid);
    const downloading = page.waitForEvent("download"); await button("Download saved match").click();
    const download = await downloading; assert.equal(await readFile(await download.path(), "utf8"), fixtures.invalid);
    await button("Start fresh").click(); await page.locator(".setup-screen").waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("outdrawn-match-v1-recovery")), fixtures.invalid);
    assert.equal(await page.evaluate(() => localStorage.getItem("outdrawn-match-v1")), null);
    assert.deepEqual(errors, []);
    console.log(`${engine}: recovery/download, reactions, inspection/focus, completed results, roster filters and reference pause passed`);
    await browser.close(); browser = null;
  }
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
