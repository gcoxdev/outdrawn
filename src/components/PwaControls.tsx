import { Download, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  canInstallApp,
  findWaitingWorker,
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  getInstallStatusDetail,
  getInstallStatusLabel,
  getUpdateServiceWorkerRegistration,
  initializeInstallPromptListener,
  subscribeToInstallPrompt,
  type BeforeInstallPromptEvent
} from "../pwa";

type UpdateStatus = "idle" | "checking" | "ready" | "updated" | "current" | "unsupported" | "error";

export function PwaControls({ allowUpdate = true }: { allowUpdate?: boolean }) {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneDisplay());
  const [hasServiceWorkerRegistration, setHasServiceWorkerRegistration] = useState<boolean | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const canInstall = canInstallApp(installPrompt, isStandalone);
  const installLabel = getInstallStatusLabel({ canInstall, isStandalone });
  const installDetail = getInstallStatusDetail({ canInstall, hasServiceWorkerRegistration, isStandalone, isSecureContext: window.isSecureContext });
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
    }).catch(() => setHasServiceWorkerRegistration(false));
  }, []);

  async function installApp() {
    if (!installPrompt) {
      return;
    }

    try { await installPrompt.prompt(); await installPrompt.userChoice; }
    catch { setUpdateStatus("error"); }
    finally { clearDeferredInstallPrompt(); }
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

      setWaitingWorker(waitingWorker);
      setUpdateStatus("ready");
    } catch {
      setUpdateStatus("error");
    }
  }

  function applyUpdate() {
    if (!waitingWorker || !allowUpdate) return;
    setUpdateStatus("updated");
    const reload = () => { window.clearTimeout(timeout); window.location.reload(); };
    const timeout = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener("controllerchange", reload);
      setUpdateStatus("error");
    }, 15000);
    navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
    if (waitingWorker.state === "activated") reload();
    else waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }

  return (
    <section className="pwa-controls" aria-label="Offline app controls">
      <header className="pwa-controls__heading"><h3><Download size={16} />Offline app</h3><span>{installLabel}</span></header>
      <div className="pwa-controls__detail">
        <p>{installDetail}</p>
        {updateMessage && <p role="status">{updateMessage}</p>}
        {updateStatus === "ready" && !allowUpdate && <p>Finish the match or return to the lobby to apply the update.</p>}
      </div>
      <div className="pwa-controls__actions">
        {updateStatus === "ready" && <button type="button" disabled={!allowUpdate} onClick={applyUpdate}>Apply Update and Reload</button>}
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

function getUpdateMessage(status: UpdateStatus) {
  const messages: Record<UpdateStatus, string> = {
    idle: "",
    checking: "Checking for the latest online version...",
    ready: "Update downloaded and ready.",
    updated: "Applying update. Reloading...",
    current: "Offline copy is up to date.",
    unsupported: "Update checks require the installed production app.",
    error: "Could not check for updates."
  };

  return messages[status];
}
