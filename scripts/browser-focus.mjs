import assert from "node:assert/strict";

/** Check native modal navigation without treating browser chrome as background UI. */
export async function assertModalTabNavigation(page, dialog, steps = 15) {
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let index = 0; index < steps; index++) {
      await page.keyboard.press(key);
      const focus = await dialog.evaluate(element => ({
        modal: element.matches(":modal"),
        inside: element.contains(document.activeElement),
        body: document.activeElement === document.body,
        active: document.activeElement?.outerHTML.slice(0, 200)
      }));
      assert(focus.modal, "Dialog must remain modal while tabbing");
      // Native dialogs can yield to browser controls. Both engines report body
      // during that transition; no control behind the modal may receive focus.
      assert(focus.inside || focus.body, `${key} ${index + 1} focused background content: ${focus.active}`);
    }
    if (await page.evaluate(() => document.activeElement === document.body)) {
      await page.keyboard.press(key);
    }
    assert(await dialog.evaluate(element => element.contains(document.activeElement)),
      `${key} must return focus to the dialog after browser controls`);
  }
}
