export function shouldRegisterServiceWorker({
  isProduction,
  hasServiceWorker
}: {
  isProduction: boolean;
  hasServiceWorker: boolean;
}) {
  return isProduction && hasServiceWorker;
}

export async function clearDevelopmentOfflineCache(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const workerUrl = new URL("/sw.js", location.origin).href;
  const controlled = navigator.serviceWorker.controller?.scriptURL === workerUrl;
  const registrations = await navigator.serviceWorker.getRegistrations();
  const owned = registrations.filter(registration =>
    [registration.active, registration.waiting, registration.installing].some(worker => worker?.scriptURL === workerUrl)
  );
  if (!controlled && owned.length === 0) return false;
  await Promise.all(owned.map(registration => registration.unregister()));
  const names = await caches.keys();
  await Promise.all(names.filter(name => name.startsWith("outdrawn-")).map(name => caches.delete(name)));
  // Unregistering does not detach the current page; one reload releases it.
  // localStorage, including the saved match, is deliberately untouched.
  return controlled;
}

export function canInstallApp(promptEvent: BeforeInstallPromptEvent | null, isStandalone: boolean) {
  return Boolean(promptEvent && !isStandalone);
}

export function getInstallStatusLabel({
  canInstall,
  isStandalone
}: {
  canInstall: boolean;
  isStandalone: boolean;
}) {
  if (isStandalone) {
    return "Installed";
  }

  return canInstall ? "Ready to install" : "Install unavailable";
}

export function getInstallStatusDetail({
  canInstall,
  hasServiceWorkerRegistration,
  isStandalone,
  isSecureContext = true
}: {
  canInstall: boolean;
  hasServiceWorkerRegistration: boolean | null;
  isStandalone: boolean;
  isSecureContext?: boolean;
}) {
  if (isStandalone) {
    return "Outdrawn is running as an installed app.";
  }

  if (canInstall) {
    return "Install Outdrawn for offline computer games.";
  }

  if (!isSecureContext) {
    return "Install requires trusted HTTPS. Trust the mkcert certificate authority on this device, then reload.";
  }

  if (hasServiceWorkerRegistration === false) {
    return "Install requires the production app or preview build so offline support can register.";
  }

  return "If the prompt is not available, use the browser install option from the address bar or menu.";
}

export async function getUpdateServiceWorkerRegistration(
  serviceWorker: Pick<ServiceWorkerContainer, "getRegistration" | "ready">,
  timeoutMs = 3000
) {
  return new Promise<ServiceWorkerRegistration | null>((resolve) => {
    let settled = false;
    let pendingCandidates = 2;

    const timeout = globalThis.setTimeout(() => {
      resolveOnce(null);
    }, timeoutMs);

    function resolveOnce(registration: ServiceWorkerRegistration | null) {
      if (settled) {
        return;
      }

      settled = true;
      globalThis.clearTimeout(timeout);
      resolve(registration);
    }

    function handleCandidate(registration: ServiceWorkerRegistration | null) {
      if (registration) {
        resolveOnce(registration);
        return;
      }

      pendingCandidates -= 1;
      if (pendingCandidates === 0) {
        resolveOnce(null);
      }
    }

    serviceWorker.getRegistration().then((registration) => handleCandidate(registration ?? null), () => handleCandidate(null));
    serviceWorker.ready.then((registration) => handleCandidate(registration), () => handleCandidate(null));
  });
}

export function registerOfflineServiceWorker() {
  if (!shouldRegisterServiceWorker({ isProduction: import.meta.env.PROD, hasServiceWorker: "serviceWorker" in navigator })) {
    return;
  }

  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Offline support registration failed.", error);
    });
  };

  if (document.readyState === "complete") {
    register();
    return;
  }

  window.addEventListener("load", register, { once: true });
}

export function findWaitingWorker(registration: ServiceWorkerRegistration, timeoutMs = 60000): Promise<ServiceWorker | null> {
  if (registration.waiting) return Promise.resolve(registration.waiting);
  const worker = registration.installing;
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => finish(new Error("Offline installation timed out")), timeoutMs);
    function finish(error?: Error) {
      globalThis.clearTimeout(timeout);
      worker!.removeEventListener("statechange", changed);
      if (error) reject(error);
      else resolve(registration.waiting ?? worker);
    }
    function changed() {
      if (worker!.state === "redundant") finish(new Error("Offline installation failed"));
      else if (["installed", "activating", "activated"].includes(worker!.state)) finish();
    }
    worker.addEventListener("statechange", changed);
    changed();
  });
}

let installPromptListenerStarted = false;
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const installPromptSubscribers = new Set<(event: BeforeInstallPromptEvent | null) => void>();

export function initializeInstallPromptListener() {
  if (installPromptListenerStarted || typeof window === "undefined") {
    return;
  }

  installPromptListenerStarted = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    notifyInstallPromptSubscribers();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    notifyInstallPromptSubscribers();
  });
}

export function getDeferredInstallPrompt() {
  return deferredInstallPrompt;
}

export function clearDeferredInstallPrompt() {
  deferredInstallPrompt = null;
  notifyInstallPromptSubscribers();
}

export function subscribeToInstallPrompt(listener: (event: BeforeInstallPromptEvent | null) => void) {
  installPromptSubscribers.add(listener);
  return () => {
    installPromptSubscribers.delete(listener);
  };
}

function notifyInstallPromptSubscribers() {
  installPromptSubscribers.forEach((listener) => listener(deferredInstallPrompt));
}

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};
