import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { canInstallApp, getInstallStatusDetail, getInstallStatusLabel, getUpdateServiceWorkerRegistration, shouldRegisterServiceWorker } from "./pwa";

afterEach(() => {
  vi.useRealTimers();
});

describe("PWA service worker registration", () => {
  it("registers only for production browsers with service worker support", () => {
    expect(shouldRegisterServiceWorker({ isProduction: true, hasServiceWorker: true })).toBe(true);
    expect(shouldRegisterServiceWorker({ isProduction: false, hasServiceWorker: true })).toBe(false);
    expect(shouldRegisterServiceWorker({ isProduction: true, hasServiceWorker: false })).toBe(false);
  });

  it("enables install only when the browser has an install prompt and app is not standalone", () => {
    const promptEvent = new Event("beforeinstallprompt") as never;

    expect(canInstallApp(promptEvent, false)).toBe(true);
    expect(canInstallApp(null, false)).toBe(false);
    expect(canInstallApp(promptEvent, true)).toBe(false);
  });

  it("labels install status clearly", () => {
    expect(getInstallStatusLabel({ canInstall: true, isStandalone: false })).toBe("Ready to install");
    expect(getInstallStatusLabel({ canInstall: false, isStandalone: true })).toBe("Installed");
    expect(getInstallStatusLabel({ canInstall: false, isStandalone: false })).toBe("Install unavailable");
  });

  it("explains why install may be unavailable", () => {
    expect(getInstallStatusDetail({ canInstall: true, hasServiceWorkerRegistration: true, isStandalone: false })).toContain("Install Outdrawn");
    expect(getInstallStatusDetail({ canInstall: false, hasServiceWorkerRegistration: false, isStandalone: false, isSecureContext: false })).toContain("trusted HTTPS");
    expect(getInstallStatusDetail({ canInstall: false, hasServiceWorkerRegistration: false, isStandalone: false })).toContain("production app");
    expect(getInstallStatusDetail({ canInstall: false, hasServiceWorkerRegistration: true, isStandalone: false })).toContain("browser install option");
    expect(getInstallStatusDetail({ canInstall: false, hasServiceWorkerRegistration: true, isStandalone: true })).toContain("installed app");
  });

  it("does not wait forever for a ready service worker", async () => {
    vi.useFakeTimers();
    const registration = {} as ServiceWorkerRegistration;
    const result = getUpdateServiceWorkerRegistration(
      {
        getRegistration: () => Promise.resolve(registration),
        ready: new Promise<ServiceWorkerRegistration>(() => undefined)
      },
      3000
    );

    await expect(result).resolves.toBe(registration);
  });

  it("times out when no update registration becomes available", async () => {
    vi.useFakeTimers();
    const result = getUpdateServiceWorkerRegistration(
      {
        getRegistration: () => Promise.resolve(undefined),
        ready: new Promise<ServiceWorkerRegistration>(() => undefined)
      },
      3000
    );

    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toBeNull();
  });

  it("lists every generated card face for offline caching", () => {
    const offlineAssetPath = join(process.cwd(), "public", "offline-assets.json");
    expect(existsSync(offlineAssetPath)).toBe(true);

    const listedAssets = JSON.parse(readFileSync(offlineAssetPath, "utf8")) as string[];
    const cardFacePaths = collectFiles(join(process.cwd(), "public", "cards", "fronts"))
      .filter((filePath) => filePath.includes("/final/") && filePath.endsWith(".png"))
      .map((filePath) => filePath.slice(join(process.cwd(), "public").length));

    expect(listedAssets).toEqual(expect.arrayContaining(cardFacePaths));
  });
});

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
}
