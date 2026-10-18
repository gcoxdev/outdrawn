import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";
import { createStaticHandler } from "./static-host.mjs";

const directory = await mkdtemp(join(tmpdir(), "outdrawn-lobby-reset-"));
const server = createServer(createStaticHandler("dist"));
let browser;
try {
  await build({ entryPoints: ["tests/decision-fixtures.ts"], bundle: true, platform: "node", format: "esm", define: { "import.meta.env.DEV": "false" }, outfile: join(directory, "fixtures.mjs") });
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
      await page.goto(origin);
      for (const name of ["reaction", "search", "trade", "noCover"]) {
        await page.evaluate(value => localStorage.setItem("outdrawn-match-v1", value), fixtures[name]);
        await page.reload();
        await page.locator(".game-table").waitFor();
        const reveal = page.getByRole("button", { name: "Reveal Hand", exact: true });
        if (await reveal.count()) await reveal.click();
        await page.getByRole("button", { name: "Open menu", exact: true }).click();
        await page.getByRole("button", { name: "Return to Lobby", exact: true }).click();
        await page.getByRole("dialog", { name: "Return to lobby?", exact: true }).getByRole("button", { name: "Return to Lobby", exact: true }).click();
        await page.locator(".setup-screen").waitFor();
        assert.equal(await page.evaluate(() => localStorage.getItem("outdrawn-match-v1")), null);
        await page.getByRole("button", { name: "Start Game", exact: true }).click();
        await page.locator(".game-table").waitFor();
        const game = await page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("outdrawn-match-v1")).payload));
        assert.equal(game.phase, "action");
        assert.equal(game.round, 1);
        assert(game.players.every(player => !player.eliminated));
        assert(Object.entries(game).filter(([key]) => key.startsWith("pending")).every(([, value]) => value === null));
        assert(!game.eventDialogQueue?.length);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${engine} ${viewport.width}px: return to lobby and start again during reaction, search, Black Market, and forced discard`);
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
