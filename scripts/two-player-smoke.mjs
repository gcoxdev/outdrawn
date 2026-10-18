import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";
import { createStaticHandler } from "./static-host.mjs";

const directory = await mkdtemp(join(tmpdir(), "outdrawn-two-player-"));
const server = createServer(createStaticHandler("dist"));
let browser;
try {
  await build({ entryPoints: ["tests/two-player-fixtures.ts"], bundle: true, platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" }, outfile: join(directory, "fixtures.mjs") });
  const fixtures = (await import(pathToFileURL(join(directory, "fixtures.mjs")).href)).fixtures();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const engine of (process.env.BROWSERS ?? "chromium,webkit").split(",")) {
    browser = await (engine === "chromium" ? chromium : webkit).launch(engine === "chromium"
      ? { executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {});
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const button = name => page.getByRole("button", { name, exact: true });
      const saved = () => page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("outdrawn-match-v1")).payload));
      await page.goto(origin);
      await page.getByLabel("Players", { exact: true }).fill("2");
      await page.getByLabel("Players", { exact: true }).press("Tab");
      assert.equal(await page.locator(".lobby-player").count(), 2);
      assert(await button("Remove a player").isDisabled());
      await page.getByLabel("Game mode", { exact: true }).selectOption("duos");
      assert(await button("Start Game").isDisabled());
      await page.getByLabel("Game mode", { exact: true }).selectOption("ffa");
      await button("Start Game").click();
      await page.locator(".game-table").waitFor();
      assert.equal((await saved()).players.length, 2);
      await page.reload();
      await page.locator(".game-table").waitFor();
      assert.equal((await saved()).players.length, 2);
      for (const mode of ["immediate", "secondary"]) {
        await page.evaluate(value => localStorage.setItem("outdrawn-match-v1", value), fixtures[mode]);
        await page.reload();
        const card = page.locator('.hand-rail button:has(img[alt^="Ricochet:"])');
        await card.click();
        await page.locator('.card-action-dialog img').evaluate(image => image.decode());
        await button("Play Ricochet").click();
        await button("Choose target").click();
        assert.equal(await page.locator(".target-option").count(), 1);
        await page.getByRole("button", { name: "Select Ari, seat 1", exact: true }).click();
        await button("Redirect to Ari").click();
        if (mode === "secondary") {
          assert.equal((await saved()).pendingSecondaryDamage.defenderId, "player_1");
          await page.reload();
          await button("Take Hit").click();
        }
        const result = await saved();
        assert.deepEqual(result.players.map(player => player.health), [17, 20]);
        assert.equal(result.pendingRedirect, null);
        assert.equal(result.pendingSecondaryDamage, null);
        assert.equal(result.players[1].damageDealt, 3);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${engine} ${viewport.width}px: two-player setup/reload, team validation, Ricochet preview/targeting, and secondary defense/reload`);
      await page.close();
    }
    await browser.close(); browser = undefined;
  }
} finally {
  await browser?.close();
  server.closeAllConnections();
  if (server.listening) await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
