import { build } from "esbuild";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const temporary = await mkdtemp(join(tmpdir(), "outdrawn-balance-"));
try {
  await mkdir("internal", { recursive: true });
  for (const legacy of [false, true]) {
    const output = join(temporary, `${legacy ? "legacy" : "current"}.mjs`);
    await build({ entryPoints: ["scripts/balance-report.ts"], bundle: true, platform: "node", format: "esm", outfile: output, define: { "import.meta.env.DEV": "false" }, plugins: legacy ? [{ name: "compare-legacy-opening-deck", setup(builder) {
      builder.onLoad({ filter: /\/game\/setup\.ts$/ }, async ({ path }) => {
        const source = await readFile(path, "utf8");
        // Change only the opening-deck policy, leaving current bot and effect code identical.
        const contents = source.replace("const requiredCards = playerCount * startingHandSize + OPENING_DRAW_RESERVE;", "const requiredCards = Math.ceil(playerCount * startingHandSize / 85) * 85;");
        if (contents === source) throw new Error("Opening-deck comparison needs updating for the current setup implementation");
        return { contents, loader: "ts" };
      });
    } }] : [] });
    const result = spawnSync(process.execPath, [output, legacy ? "internal/balance-legacy-deck.json" : "internal/balance-followup.json"], { stdio: "inherit" });
    if (result.status !== 0) process.exitCode = result.status ?? 1;
  }
} finally { await rm(temporary, { recursive: true, force: true }); }
