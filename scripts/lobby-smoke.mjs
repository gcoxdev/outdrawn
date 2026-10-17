import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium, webkit } from "playwright";
import { createStaticHandler } from "./static-host.mjs";

const server = createServer(createStaticHandler("dist"));
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  for (const engine of ["chromium", "webkit"]) {
    browser = await (engine === "chromium" ? chromium : webkit).launch(engine === "chromium"
      ? { executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {});
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin);
    const start = page.getByRole("button", { name: "Start Game", exact: true });
    await start.waitFor();
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await fits(), `${engine}: lobby overflows at ${width}px`);
    }
    await page.setViewportSize({ width: 844, height: 390 });
    assert(await fits(), "Landscape lobby must fit");
    assert(await start.evaluate(element => element.getBoundingClientRect().bottom <= innerHeight), "Start must stay visible in landscape");
    await page.setViewportSize({ width: 320, height: 740 });
    assert(await page.getByLabel("Player 1 name", { exact: true }).evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 16), "Touch input text must avoid focus zoom");
    await page.getByRole("button", { name: "Open menu", exact: true }).tap();
    assert(await page.evaluate(() => !!document.activeElement.closest("dialog[open]")));
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Open menu");

    await page.getByLabel("Player 2 control", { exact: true }).selectOption("human");
    await page.getByLabel("Computer difficulty", { exact: true }).selectOption("expert");
    assert.equal(await page.getByLabel("Player 2 control", { exact: true }).inputValue(), "human", "Bulk difficulty must preserve humans");
    assert.equal(await page.getByLabel("Player 3 control", { exact: true }).inputValue(), "computer:expert");
    await page.getByRole("button", { name: "Add a player", exact: true }).tap();
    assert.equal(await page.getByLabel("Player 5 control", { exact: true }).inputValue(), "computer:expert");
    await page.getByLabel("Game mode", { exact: true }).selectOption("duos");
    assert(await start.isDisabled());
    assert(await page.locator(".lobby-validation").isVisible());
    await page.getByRole("button", { name: "Add a player", exact: true }).tap();
    assert(await start.isEnabled());
    assert.equal(await page.getByLabel("Player 6 team", { exact: true }).inputValue(), "team_3");
    assert(await fits(), "Team controls must fit a narrow phone");
    await page.getByLabel("Game mode", { exact: true }).selectOption("custom");
    await page.getByLabel("Player 1 team", { exact: true }).selectOption("team_2");
    await page.getByLabel("Players", { exact: true }).focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.getByLabel("Player 1 team", { exact: true }).inputValue(), "team_2", "Leaving an unchanged count must preserve custom teams");
    await page.getByLabel("Game mode", { exact: true }).selectOption("ffa");

    const count = page.getByLabel("Players", { exact: true });
    await count.fill("");
    await count.pressSequentially("100");
    await count.press("Tab");
    assert.equal(await count.inputValue(), "100", "Typing 100 must not clamp the first digit");
    assert.equal(await page.locator(".lobby-player").count(), 20);
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Next players", exact: true }).tap();
    await page.getByLabel("Player 100 name", { exact: true }).fill("Last Seat");
    await page.getByRole("button", { name: "Previous players", exact: true }).tap();
    await page.getByRole("button", { name: "Next players", exact: true }).tap();
    assert.equal(await page.getByLabel("Player 100 name", { exact: true }).inputValue(), "Last Seat");
    await count.fill("4");
    await count.press("Tab");
    await page.getByRole("button", { name: "Fill with computers", exact: true }).tap();
    assert.equal(await page.getByLabel("Player 1 control", { exact: true }).inputValue(), "human");
    assert.equal(await page.getByLabel("Player 2 control", { exact: true }).inputValue(), "computer:expert");
    await page.getByLabel("Player 1 name", { exact: true }).fill("Lobby Tester");

    await page.getByText("Advanced rules", { exact: true }).tap();
    const turnOrder = page.getByLabel("Turn order", { exact: true });
    assert.equal(await turnOrder.inputValue(), "roundRobin");
    assert.deepEqual(await turnOrder.locator("option").allTextContents(), ["Round robin", "Rotating start"]);
    await turnOrder.selectOption({ label: "Rotating start" });
    await page.getByLabel("Defense on secondary attacks", { exact: true }).check();
    await page.locator(".lobby-disclosure--market summary").tap();
    await page.getByLabel("Market preset", { exact: true }).selectOption("custom");
    await page.getByLabel("Reveal", { exact: true }).fill("5");
    await page.getByLabel("Keep", { exact: true }).fill("2");
    await page.getByLabel("Starting health", { exact: true }).fill("30");
    assert.equal(await page.getByLabel("Max health", { exact: true }).inputValue(), "30");
    assert(await fits(), "Expanded custom rules must fit a narrow phone");
    await start.tap();
    await page.locator(".game-table").waitFor();
    const saved = await page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("outdrawn-match-v1")).payload));
    assert.equal(saved.players.length, 4);
    assert.equal(saved.players[0].name, "Lobby Tester");
    assert.equal(saved.players[1].controller.strategy, "expert");
    assert.equal(saved.settings.startingHealth, 30);
    assert.equal(saved.settings.turnOrder, "standard");
    assert.equal(saved.settings.allowSecondaryDefense, true);
    assert.equal(saved.settings.blackMarketCustom.keepCount, 2);
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine}: responsive lobby, touch, menu focus, teams, difficulty, 100-player editing, custom rules, match launch`);
    await browser.close(); browser = undefined;
  }
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
