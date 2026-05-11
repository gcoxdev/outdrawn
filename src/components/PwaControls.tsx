import { Download, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  canInstallApp,
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  getInstallStatusDetail,
  getInstallStatusLabel,
  getUpdateServiceWorkerRegistration,
  initializeInstallPromptListener,
  subscribeToInstallPrompt,
  type BeforeInstallPromptEvent
} from "../pwa";

type UpdateStatus = "idle" | "checking" | "updated" | "current" | "unsupported" | "error";

export function PwaControls() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneDisplay());
  const [hasServiceWorkerRegistration, setHasServiceWorkerRegistration] = useState<boolean | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const canInstall = canInstallApp(installPrompt, isStandalone);
  const installLabel = getInstallStatusLabel({ canInstall, isStandalone });
  const installDetail = getInstallStatusDetail({ canInstall, hasServiceWorkerRegistration, isStandalone });
  const updateMessage = useMemo(() => getUpdateMessage(updateStatus), [updateStatus]);

  useEffect(() => {
    function handleAppInstalled() {
      clearDeferredInstallPrompt();
      setIsStandalone(true);
    }

    initializeInstallPromptListener();
    setInstallPrompt(getDeferredInstallPrompt());
    const unsubscribe = subscribeToInstallPrompt(setInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      unsubscribe();
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setHasServiceWorkerRegistration(false);
      return;
    }

    navigator.serviceWorker.getRegistration().then((registration) => {
      setHasServiceWorkerRegistration(Boolean(registration));
    });
  }, []);

  async function installApp() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      clearDeferredInstallPrompt();
    }
  }

  async function checkForUpdates() {
    if (!("serviceWorker" in navigator)) {
      setUpdateStatus("unsupported");
      return;
    }

    setUpdateStatus("checking");
    try {
      const registration = await getUpdateServiceWorkerRegistration(navigator.serviceWorker);
      if (!registration) {
        setUpdateStatus("unsupported");
        return;
      }

      await registration.update();
      const waitingWorker = await findWaitingWorker(registration);
      if (!waitingWorker) {
        setUpdateStatus("current");
        return;
      }

      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          window.location.reload();
        },
        { once: true }
      );
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      setUpdateStatus("updated");
    } catch {
      setUpdateStatus("error");
    }
  }

  return (
    <section className="pwa-controls setting-control setting-control--wide" aria-label="Offline app controls">
      <div>
        <span>Offline App</span>
        <p>{installLabel}</p>
        <p>{installDetail}</p>
        {updateMessage && <p>{updateMessage}</p>}
      </div>
      <div className="pwa-controls__actions">
        <button type="button" disabled={!canInstall} onClick={installApp}>
          <Download size={16} />
          Install
        </button>
        <button type="button" disabled={updateStatus === "checking"} onClick={checkForUpdates}>
          <RefreshCw size={16} />
          {updateStatus === "checking" ? "Checking" : "Check Updates"}
        </button>
      </div>
    </section>
  );
}

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function findWaitingWorker(registration: ServiceWorkerRegistration) {
  if (registration.waiting) {
    return Promise.resolve(registration.waiting);
  }

  const installingWorker = registration.installing;
  if (!installingWorker) {
    return Promise.resolve(null);
  }

  return new Promise<ServiceWorker | null>((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve(null);
    }, 3000);

    installingWorker.addEventListener(
      "statechange",
      () => {
        window.clearTimeout(timeout);
        resolve(registration.waiting ?? null);
      },
      { once: true }
    );
  });
}

function getUpdateMessage(status: UpdateStatus) {
  const messages: Record<UpdateStatus, string> = {
    idle: "",
    checking: "Checking for the latest online version...",
    updated: "Update found. Reloading...",
    current: "Offline copy is up to date.",
    unsupported: "Update checks require the installed production app.",
    error: "Could not check for updates."
  };

  return messages[status];
}
