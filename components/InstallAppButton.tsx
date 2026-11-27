"use client";

import { useEffect, useState } from "react";

/** Chrome's install offer: held back from its own mini-bar, shown when the customer asks. */
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "other";

/**
 * "Install the app". Always offered on the menu (except inside the installed
 * app itself), because Chrome only makes its own one-tap offer after a visitor
 * has spent a while on the page — a button that appeared only then would seem
 * not to exist. Tapping it installs straight away when Chrome is ready, and
 * otherwise shows the two steps for this phone: Chrome's ⋮ menu on Android,
 * Share → Add to Home Screen on an iPhone (Safari lets no page install itself).
 */
export default function InstallAppButton({ shopName }: { shopName: string }) {
  const [offer, setOffer] = useState<InstallPrompt | null>(null);
  // Unknown until mounted: the server cannot tell an installed app from a tab.
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    // Already running as the installed app: nothing to offer.
    if (window.matchMedia?.("(display-mode: standalone)").matches) setInstalled(true);
    setPlatform(/iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios" : "other");

    function onOffer(event: Event) {
      // Keep Chrome's own banner away; this button makes the same offer.
      event.preventDefault();
      setOffer(event as InstallPrompt);
    }
    function onInstalled() {
      setInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", onOffer);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onOffer);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !platform) return null;

  async function install() {
    if (!offer) {
      setShowSteps(true);
      return;
    }
    await offer.prompt();
    const { outcome } = await offer.userChoice;
    // An offer can be used once.
    setOffer(null);
    if (outcome === "accepted") setInstalled(true);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={install}
        aria-expanded={offer ? undefined : showSteps}
        className="w-full rounded-2xl border border-dashed border-[var(--accent)] py-2.5 text-sm font-semibold text-[var(--accent)]"
      >
        📲 Install the {shopName} app
      </button>

      {showSteps && (
        <ol className="mt-2 space-y-1 rounded-2xl bg-[var(--bg)] px-4 py-3 text-left text-xs leading-relaxed text-[var(--text)]">
          {platform === "ios" ? (
            <>
              <li>
                1. In <strong>Safari</strong>, tap <strong>Share</strong> (the square with an arrow).
              </li>
              <li>
                2. Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
              </li>
            </>
          ) : (
            <>
              <li>
                1. In <strong>Chrome</strong>, tap <strong>⋮</strong> at the top right.
              </li>
              <li>
                2. Choose <strong>Install app</strong> (or <strong>Add to Home screen</strong>), then{" "}
                <strong>Install</strong>.
              </li>
            </>
          )}
        </ol>
      )}
    </div>
  );
}
