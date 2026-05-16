import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:https";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.env.OUTDRAWN_STATIC_ROOT ?? "dist");
const host = process.env.HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const certPath = resolve(process.env.HTTPS_CERT ?? "certs/outdrawn.pem");
const keyPath = resolve(process.env.HTTPS_KEY ?? "certs/outdrawn-key.pem");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

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

const server = createServer({ cert, key }, (request, response) => {
  if (!request.url) {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const url = new URL(request.url, `https://${request.headers.host ?? "localhost"}`);
  const requestedPath = decodeURIComponent(url.pathname);
  const filePath = resolvePath(requestedPath);
  const finalPath = filePath && existsSync(filePath) && statSync(filePath).isFile() ? filePath : join(root, "index.html");

  response.setHeader("Cache-Control", cacheHeader(finalPath));
  response.setHeader("Content-Type", contentTypes[extname(finalPath)] ?? "application/octet-stream");
  createReadStream(finalPath)
    .on("error", () => {
      response.writeHead(500);
      response.end("Server error");
    })
    .pipe(response);
});

server.listen(port, host, () => {
  console.log(`Outdrawn HTTPS host listening on https://${host}:${port}`);
  console.log("Open https://YOUR_LAN_IP:" + port + " from another trusted device.");
});

function resolvePath(requestedPath) {
  const normalized = normalize(requestedPath).replace(/^([/\\])+/, "");
  const filePath = resolve(root, normalized);
  return filePath === root || filePath.startsWith(root + sep) ? filePath : null;
}

function cacheHeader(filePath) {
  const relative = filePath.slice(root.length + 1);
  if (relative === "index.html" || relative === "sw.js" || relative === "manifest.webmanifest") {
    return "no-cache";
  }

  return "public, max-age=31536000, immutable";
}
