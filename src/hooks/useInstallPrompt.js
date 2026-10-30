import { useCallback, useEffect, useState } from "react";

/**
 * PWA install prompt.
 * - Chrome/Edge/Android: beforeinstallprompt → native dialog
 * - iOS Safari: manual Share → Add to Home Screen
 * - Other mobile: show how-to sheet
 * - Already installed (standalone): hide
 */
let deferred = null;
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

function detectMobile() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "") ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
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
  const isMobile = detectMobile();
  const canPrompt = !!deferred;

  const install = useCallback(async () => {
    if (!deferred) return "unavailable";
    const prompt = deferred;
    deferred = null;
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
    isMobile,
    // Show on mobile until installed (native prompt or help sheet)
    visible: !installed && (canPrompt || isIos || isMobile),
    install,
  };
}
