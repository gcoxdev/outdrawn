import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:https";
import { resolve } from "node:path";
import { createStaticHandler } from "./static-host.mjs";

const root = resolve(process.env.OUTDRAWN_STATIC_ROOT ?? "dist");
const host = process.env.HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const certPath = resolve(process.env.HTTPS_CERT ?? "certs/outdrawn.pem");
const keyPath = resolve(process.env.HTTPS_KEY ?? "certs/outdrawn-key.pem");

if (!existsSync(root)) {
  console.error(`Missing ${root}. Run npm run build first.`);
  process.exit(1);
}

if (!existsSync(certPath) || !existsSync(keyPath)) {
  console.error(`Missing HTTPS certificate files:
  cert: ${certPath}
  key:  ${keyPath}

Create them with mkcert or set HTTPS_CERT and HTTPS_KEY.`);
  process.exit(1);
}

const [cert, key] = await Promise.all([readFile(certPath), readFile(keyPath)]);

const server = createServer({ cert, key }, createStaticHandler(root));

server.listen(port, host, () => {
  console.log(`Outdrawn HTTPS host listening on https://${host}:${port}`);
  console.log("Open https://YOUR_LAN_IP:" + port + " from another trusted device.");
});
