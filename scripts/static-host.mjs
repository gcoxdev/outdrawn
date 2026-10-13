import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const contentTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".webmanifest": "application/manifest+json; charset=utf-8"
};

export function createStaticHandler(directory) {
  const root = resolve(directory);
  return async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
      if (pathname.includes("\0") || pathname.includes("\\")) throw new Error("Invalid path");
    } catch {
      response.writeHead(400).end("Bad request");
      return;
    }
    const filePath = resolve(root, pathname === "/" ? "index.html" : `.${pathname}`);
    if (!filePath.startsWith(root + sep)) {
      response.writeHead(404).end("Not found");
      return;
    }
    try {
      if (!(await stat(filePath)).isFile()) throw new Error("Not a file");
    } catch {
      response.writeHead(404, { "Cache-Control": "no-store" }).end("Not found");
      return;
    }
    const immutable = /^\/assets\/[^/]+-[\w-]{8,}\.[\w]+$/.test(pathname);
    response.setHeader("Cache-Control", immutable ? "public, max-age=31536000, immutable" : "no-cache");
    response.setHeader("Content-Type", contentTypes[extname(filePath)] ?? "application/octet-stream");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (request.method === "HEAD") { response.end(); return; }
    createReadStream(filePath).on("error", () => {
      if (!response.headersSent) response.writeHead(500);
      response.end("Server error");
    }).pipe(response);
  };
}
