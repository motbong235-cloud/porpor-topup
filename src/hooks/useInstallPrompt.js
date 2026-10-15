import { useCallback, useEffect, useState } from "react";

/**
 * "Download as app" (PWA install).
 *  - Android / Chrome / Edge / desktop: captures `beforeinstallprompt` and shows the native install dialog.
 *  - iOS Safari: no install API exists, so we expose `isIos` and the UI shows "Share → Add to Home Screen".
 *  - Already installed (standalone): `installed` is true and the button is hidden.
 */
let deferred = null; // survive component remounts
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

function detectIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(ua) || iPadOS;
}

export function useInstallPrompt() {
  const [, force] = useState(0);
  const [installedNow, setInstalledNow] = useState(false);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    const onInstalled = () => setInstalledNow(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      listeners.delete(fn);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const installed = installedNow || isStandalone();
  const isIos = detectIos();
  const canPrompt = !!deferred;

  const install = useCallback(async () => {
    if (!deferred) return "unavailable";
    const prompt = deferred;
    deferred = null; // a prompt event can only be used once
    notify();
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      return choice && choice.outcome === "accepted" ? "accepted" : "dismissed";
    } catch {
      return "dismissed";
    }
  }, []);

  return {
    installed,
    canPrompt,
    isIos,
    // show a button when the browser can prompt, or on iOS Safari (manual steps)
    visible: !installed && (canPrompt || isIos),
    install,
  };
}
