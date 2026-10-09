"use client";

import { useEffect, useState } from "react";

/** Chrome's install offer: held back from its own mini-bar, shown when the customer asks. */
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * "Install the app" — only where the browser can actually install it (Chrome
 * on Android announces that with `beforeinstallprompt`), and never once it is
 * installed. Hidden everywhere else, iPhones included: Safari gives a page no
 * way to do this, and a button that cannot work is worse than none.
 */
export default function InstallAppButton({ shopName }: { shopName: string }) {
  const [offer, setOffer] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    function onOffer(event: Event) {
      // Keep Chrome's own banner away; the button below makes the same offer.
      event.preventDefault();
      setOffer(event as InstallPrompt);
    }
    function onInstalled() {
      setOffer(null);
    }

    window.addEventListener("beforeinstallprompt", onOffer);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onOffer);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!offer) return null;
  const pending = offer;

  async function install() {
    await pending.prompt();
    await pending.userChoice;
    // An offer can be used once; whatever they chose, the button has done its job.
    setOffer(null);
  }

  return (
    <button
      type="button"
      onClick={install}
      className="mt-3 w-full rounded-2xl border border-dashed border-[var(--accent)] py-2.5 text-sm font-semibold text-[var(--accent)]"
    >
      📲 Install the {shopName} app
    </button>
  );
}
