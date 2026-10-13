import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "retire-development-offline-worker",
      apply: "serve",
      configureServer(server) {
        // A production worker can survive switching this origin back to Vite.
        // Serve a replacement that retires it instead of the unbuilt template.
        server.middlewares.use((request, response, next) => {
          if (request.url?.split("?")[0] !== "/sw.js") return next();
          response.setHeader("Content-Type", "text/javascript");
          response.setHeader("Cache-Control", "no-store");
          response.end(`
            self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
            self.addEventListener("activate", event => event.waitUntil((async () => {
              const names = await caches.keys();
              await Promise.all(names.filter(name => name.startsWith("outdrawn-")).map(name => caches.delete(name)));
              await self.clients.claim();
              await self.registration.unregister();
              const clients = await self.clients.matchAll({ type: "window" });
              await Promise.all(clients.map(client => client.navigate(client.url)));
            })()));
          `);
        });
      }
    }
  ],
  // Mixed cached dependency generations can instantiate React twice on reload.
  server: { headers: { "Cache-Control": "no-store" } },
  // Production assets keep their normal HTTP caching policy.
  preview: { headers: {} }
});
