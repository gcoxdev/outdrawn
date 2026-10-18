import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium, webkit } from "playwright";
import { createStaticHandler } from "./static-host.mjs";
import { assertModalTabNavigation } from "./browser-focus.mjs";

const server = createServer(createStaticHandler("dist"));
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  for (const engine of ["chromium", "webkit"]) {
    browser = await (engine === "chromium" ? chromium : webkit).launch(engine === "chromium"
      ? { executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--no-sandbox"] } : {});
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: engine === "webkit", isMobile: engine === "webkit", reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const open = () => page.getByRole("button", { name: "Open menu", exact: true }).click();
    const tab = name => page.getByRole("tab", { name, exact: true });
    const close = () => page.getByRole("button", { name: "Close menu", exact: true }).click();
    const screenshot = async name => {
      if (process.env.MENU_SCREENSHOTS && engine === "chromium") await page.screenshot({ path: `internal/menu-${name}.png` });
    };
    await open();
    assert.equal(await page.getByRole("button", { name: "Return to Lobby", exact: true }).count(), 0, "Lobby should not offer a redundant reset");
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Close menu");
    await screenshot("desktop");
    await tab("Settings").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await tab("Rules").getAttribute("aria-selected"), "true");
    assert.equal(await tab("Rules").evaluate(element => element === document.activeElement), true);
    const collapse = page.locator(".menu-rule-section").filter({ has: page.locator("summary", { hasText: /^Collapse$/ }) });
    await collapse.locator("summary").click();
    assert.match(await collapse.innerText(), /end of Round 3/);
    await screenshot("rules");
    await tab("Rules").press("End");
    assert.equal(await tab("Cards").getAttribute("aria-selected"), "true");
    const search = page.getByRole("searchbox", { name: "Search cards", exact: true });
    const cardCount = await page.locator(".catalog-card").count();
    assert(cardCount > 30);
    await search.fill("pIsToL");
    assert.equal(await page.locator(".catalog-card").count(), 1);
    assert.equal(await page.locator(".catalog-card strong").innerText(), "Pistol");
    const viewPistol = page.getByRole("button", { name: "View Pistol card", exact: true });
    await viewPistol.click();
    const preview = page.getByRole("dialog", { name: "Pistol card preview", exact: true });
    await preview.locator("img").evaluate(image => image.decode());
    assert.match(await preview.locator("img").getAttribute("src"), /weapon-pistol-dark-01/);
    for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
    assert(await page.evaluate(() => !!document.activeElement.closest(".card-preview-overlay")), "Preview must contain keyboard focus");
    await screenshot("card-preview-desktop");
    for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
      await page.setViewportSize({ width, height });
      assert(await preview.locator(".card-preview-panel").evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1;
      }), `Card preview outside ${width}×${height}`);
      assert(await preview.locator("img").evaluate(element => {
        const rect = element.getBoundingClientRect();
        return element.naturalWidth > 0 && rect.bottom <= innerHeight && rect.width > 0;
      }));
      if (width === 390) await screenshot("card-preview-mobile");
    }
    await page.keyboard.press("Escape");
    await preview.waitFor({ state: "detached" });
    assert(await page.getByRole("dialog", { name: "Game menu", exact: true }).isVisible(), "Escape closes only the card preview");
    assert.equal(await viewPistol.evaluate(element => element === document.activeElement), true);
    assert.equal(await search.inputValue(), "pIsToL", "Preview must preserve search");
    await page.setViewportSize({ width: 1440, height: 900 });
    await viewPistol.click();
    await page.mouse.click(20, 20);
    await preview.waitFor({ state: "detached" });
    assert.equal(await viewPistol.evaluate(element => element === document.activeElement), true);
    await page.getByLabel("Card type", { exact: true }).selectOption("healing");
    assert.equal(await page.locator(".catalog-card").count(), 0);
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    assert.equal(await search.evaluate(element => element === document.activeElement), true);
    assert.equal(await page.locator(".catalog-card").count(), cardCount);
    // Exercise every artwork mapping, including cards with legacy IDs.
    const viewButtons = page.locator(".catalog-card__view");
    assert.equal(await viewButtons.count(), cardCount);
    for (let index = 0; index < cardCount; index++) {
      const button = viewButtons.nth(index);
      await button.click();
      const image = page.locator(".card-preview-overlay img");
      await image.evaluate(image => image.decode());
      assert(await image.evaluate(image => image.naturalWidth > 0));
      await page.getByRole("button", { name: "Close card preview", exact: true }).click();
      assert.equal(await button.evaluate(element => element === document.activeElement), true);
    }
    await search.fill("damage");
    assert(await page.locator(".catalog-card").count() > 1, "Search must include card rules");
    await page.getByRole("button", { name: "Clear card search", exact: true }).click();
    assert.equal(await search.evaluate(element => element === document.activeElement), true);
    await screenshot("cards");
    for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [844, 390], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      for (const name of ["Settings", "Rules", "Cards"]) {
        await tab(name).click();
        assert(await page.locator(".menu-panel").evaluate(element => {
          const rect = element.getBoundingClientRect();
          return rect.left >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;
        }), `${engine}: ${name} drawer outside ${width}×${height}`);
        assert(await page.getByRole("tabpanel").evaluate(element => element.scrollWidth <= element.clientWidth + 1), `${name} content overflows at ${width}px`);
        await page.getByRole("tabpanel").evaluate(element => { element.scrollTop = element.scrollHeight; });
        assert(await page.getByRole("button", { name: "Close menu", exact: true }).isVisible());
        assert(await tab(name).evaluate(element => element.getBoundingClientRect().top >= 0), "Tabs must stay visible while scrolling");
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await tab("Settings").click();
    await screenshot("mobile");
    await assertModalTabNavigation(page, page.getByRole("dialog", { name: "Game menu", exact: true }));
    await page.getByRole("checkbox", { name: "Pass device mode", exact: true }).check();
    await page.getByRole("button", { name: "Check Updates", exact: true }).click();
    await page.getByText("Offline copy is up to date.", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Game menu", exact: true }).waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Open menu");
    await open();
    assert(await page.getByRole("checkbox", { name: "Pass device mode", exact: true }).isChecked());
    await close();
    await page.setViewportSize({ width: 1440, height: 900 });
    await open();
    await page.mouse.click(30, 30);
    await page.getByRole("dialog", { name: "Game menu", exact: true }).waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), "visible");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Players", { exact: true }).fill("3");
    await page.getByLabel("Player 2 control", { exact: true }).selectOption("human");
    await page.getByLabel("Player 3 control", { exact: true }).selectOption("human");
    await page.getByRole("button", { name: "Start Game", exact: true }).click();
    await page.getByRole("button", { name: "Reveal Hand", exact: true }).click();
    await open();
    const snapshot = () => page.evaluate(() => localStorage.getItem("outdrawn-match-v1"));
    const privacy = page.getByRole("checkbox", { name: "Pass device mode", exact: true });
    const protectedSave = await snapshot();
    await privacy.click();
    const privacyConfirmation = page.getByRole("dialog", { name: "Turn off pass-device mode?", exact: true });
    await privacyConfirmation.waitFor();
    assert(await privacy.isChecked(), "Privacy stays enabled until confirmed");
    assert(await privacyConfirmation.getByRole("button", { name: "Keep hands hidden" }).evaluate(element => element === document.activeElement));
    await page.keyboard.press("Escape");
    assert.equal(await snapshot(), protectedSave, "Canceling privacy change preserves the match");
    assert(await privacy.evaluate(element => element === document.activeElement));
    await privacy.click();
    await privacyConfirmation.getByRole("button", { name: "Turn off", exact: true }).click();
    assert(!(await privacy.isChecked()));
    assert.equal(JSON.parse(JSON.parse(await snapshot()).payload).settings.passDeviceMode, false);
    await privacy.check();
    assert.equal(await privacyConfirmation.count(), 0, "Enabling privacy needs no warning");
    const before = await snapshot();
    await page.getByRole("button", { name: "Restart Game", exact: true }).click();
    const restartConfirmation = page.getByRole("dialog", { name: "Restart match?", exact: true });
    await restartConfirmation.waitFor();
    assert(await restartConfirmation.getByRole("button", { name: "Keep playing" }).evaluate(element => element === document.activeElement));
    await page.keyboard.press("Escape");
    assert.equal(await snapshot(), before, "Canceling restart must preserve the match");
    assert(await page.getByRole("dialog", { name: "Game menu", exact: true }).isVisible());
    assert(await page.getByRole("button", { name: "Restart Game", exact: true }).evaluate(element => element === document.activeElement));
    await page.getByRole("button", { name: "Restart Game", exact: true }).click();
    await restartConfirmation.getByRole("button", { name: "Restart Game", exact: true }).click();
    await page.getByRole("dialog", { name: "Game menu", exact: true }).waitFor({ state: "detached" });
    // The same first player may remain revealed after restart; a different
    // first player receives the privacy gate.
    const reveal = page.getByRole("button", { name: "Reveal Hand", exact: true });
    if (await reveal.count()) await reveal.click();
    const restarted = JSON.parse(JSON.parse(await snapshot()).payload);
    assert.equal(restarted.phase, "action");
    assert.equal(restarted.players.length, 3);
    await open();
    await page.getByRole("button", { name: "Return to Lobby", exact: true }).click();
    const lobbyConfirmation = page.getByRole("dialog", { name: "Return to lobby?", exact: true });
    await lobbyConfirmation.getByRole("button", { name: "Keep playing" }).click();
    assert(await page.locator(".game-table").isVisible());
    await page.getByRole("button", { name: "Return to Lobby", exact: true }).click();
    await lobbyConfirmation.getByRole("button", { name: "Return to Lobby", exact: true }).click();
    await page.locator(".setup-screen").waitFor();
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine}: drawer layouts, card previews/artwork, keyboard focus, rules, search/filter, privacy, updates, and match actions`);
    await browser.close(); browser = undefined;
  }
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
