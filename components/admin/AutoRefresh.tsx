"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the Orders page current while it is open, and puts the count of new
 * orders in the browser tab — "(2) Admin" — so it shows from another tab.
 * Silent on purpose: WhatsApp already rings the owner's phone for each order.
 */
export default function AutoRefresh({ seconds, newCount }: { seconds: number; newCount: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      // A hidden tab has no one looking; skip the work until it is shown.
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, seconds]);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = newCount > 0 ? `(${newCount}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [newCount]);

  return null;
}
