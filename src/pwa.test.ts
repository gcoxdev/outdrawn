import { afterEach, describe, expect, it, vi } from "vitest";
import { canInstallApp, findWaitingWorker, getInstallStatusDetail, getInstallStatusLabel, getUpdateServiceWorkerRegistration, shouldRegisterServiceWorker } from "./pwa";

afterEach(() => {
  vi.useRealTimers();
});

describe("PWA service worker registration", () => {
  it("waits through installing states and rejects failed installations", async () => {
    const worker = Object.assign(new EventTarget(), { state: "installing" });
    const registration = { installing: worker, waiting: null } as unknown as ServiceWorkerRegistration;
    let resolved = false;
    const waiting = findWaitingWorker(registration).then(value => { resolved = true; return value; });
    worker.dispatchEvent(new Event("statechange"));
    await Promise.resolve();
    expect(resolved).toBe(false);
    worker.state = "installed";
    worker.dispatchEvent(new Event("statechange"));
    expect(await waiting).toBe(worker);
    worker.state = "redundant";
    await expect(findWaitingWorker(registration)).rejects.toThrow("failed");
  });

  it("treats installation timeout as an error rather than an up-to-date result", async () => {
    vi.useFakeTimers();
    const worker = Object.assign(new EventTarget(), { state: "installing" });
    const promise = findWaitingWorker({ installing: worker } as unknown as ServiceWorkerRegistration, 100);
    const rejected = expect(promise).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
  });
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

});
