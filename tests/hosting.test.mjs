import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStaticHandler } from "../scripts/static-host.mjs";

test("host survives malformed paths, rejects missing files, and revalidates stable assets", async () => {
  const root = await mkdtemp(join(tmpdir(), "outdrawn-host-"));
  const server = createServer(createStaticHandler(root));
  try {
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "index.html"), "<html>app</html>");
    await writeFile(join(root, "offline-assets.json"), "[]");
    await writeFile(join(root, "assets/app-abcdefgh.js"), "export {};");
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(origin + "/%ZZ")).status, 400);
    assert.equal((await fetch(origin + "/")).status, 200);
    for (const path of ["/cards/missing.png", "/assets/missing.js", "/sw.js"]) assert.equal((await fetch(origin + path)).status, 404);
    assert.equal((await fetch(origin + "/offline-assets.json")).headers.get("cache-control"), "no-cache");
    assert.match((await fetch(origin + "/assets/app-abcdefgh.js")).headers.get("cache-control"), /immutable/);
    assert.equal((await fetch(origin + "/", { method: "POST" })).status, 405);
    assert.equal(await (await fetch(origin + "/", { method: "HEAD" })).text(), "");
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
