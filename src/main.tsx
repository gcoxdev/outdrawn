import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./components/GameTable.css";
import { clearDevelopmentOfflineCache, initializeInstallPromptListener, registerOfflineServiceWorker } from "./pwa";

async function startApp() {
  if (import.meta.env.DEV) {
    try {
      if (await clearDevelopmentOfflineCache()) {
        location.reload();
        return;
      }
    } catch (error) {
      console.warn("Could not remove the development offline cache.", error);
    }
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );

  initializeInstallPromptListener();
  registerOfflineServiceWorker();
}

void startApp();
