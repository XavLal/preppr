import { useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "preppr:pwa-install-dismissed-at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (typeof window.navigator === "object" &&
      "standalone" in window.navigator &&
      window.navigator.standalone === true)
  );
}

function isIosSafari() {
  const ua = window.navigator.userAgent.toLowerCase();
  const iosDevice = /iphone|ipad|ipod/.test(ua);
  const webkit = /safari/.test(ua);
  const otherBrowser = /crios|fxios|edgios|opios/.test(ua);
  return iosDevice && webkit && !otherBrowser;
}

function isLikelyMobile() {
  return window.matchMedia("(max-width: 820px)").matches;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (isStandaloneMode()) return;

    const rawDismissDate = window.localStorage.getItem(DISMISS_KEY);
    const dismissedAt = rawDismissDate ? Number(rawDismissDate) : NaN;
    const stillDismissed =
      Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_TTL_MS;
    setDismissed(stillDismissed);
  }, []);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  const showIosHelp = useMemo(
    () => isLikelyMobile() && isIosSafari() && !isStandaloneMode(),
    [],
  );
  const canInstallDirectly = useMemo(
    () => isLikelyMobile() && deferredPrompt !== null && !isStandaloneMode(),
    [deferredPrompt],
  );

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  async function installApp() {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setIsInstalling(false);
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") {
      setDismissed(true);
      return;
    }
    dismiss();
  }

  if (dismissed || (!canInstallDirectly && !showIosHelp)) {
    return null;
  }

  return (
    <aside className="pwa-install-banner card" aria-live="polite">
      <p className="pwa-install-title">Installe Preppr sur votre mobile</p>
      {canInstallDirectly ? (
        <p className="muted small">
          Accédez plus vite à vos recettes et utilisez la liste de courses comme une app.
        </p>
      ) : (
        <p className="muted small">
          Sur iPhone, touchez <strong>Partager</strong> puis{" "}
          <strong>Sur l&apos;écran d&apos;accueil</strong>.
        </p>
      )}
      <div className="row end pwa-install-actions">
        <button type="button" className="btn ghost" onClick={dismiss}>
          Plus tard
        </button>
        {canInstallDirectly ? (
          <button type="button" className="btn primary" disabled={isInstalling} onClick={installApp}>
            Installer
          </button>
        ) : null}
      </div>
    </aside>
  );
}
