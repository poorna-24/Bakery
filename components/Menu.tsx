"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MenuCategory, MenuItem } from "@/lib/types";
import type { Appearance } from "@/lib/backgrounds";
import type { ShopHours, ShopStatus } from "@/lib/hours";
import type { Offer } from "@/lib/offer";
import ItemCard from "./ItemCard";
import ItemSheet from "./ItemSheet";
import Footer from "./Footer";
import Backdrop from "./Backdrop";
import Wordmark, { Flourish } from "./Wordmark";
import OpenStatus from "./OpenStatus";
import OfferBanner from "./OfferBanner";

type Props = {
  categories: MenuCategory[];
  shopName: string;
  tagline: string;
  address: string;
  mapUrl: string;
  phone: string;
  whatsapp: string;
  credit: { name: string; whatsapp: string };
  appearance: Appearance;
  hours: ShopHours | null;
  hoursStatus: ShopStatus | null;
  offer: Offer | null;
};

export default function Menu({
  categories,
  shopName,
  tagline,
  address,
  mapUrl,
  phone,
  whatsapp,
  credit,
  appearance,
  hours,
  hoursStatus,
  offer,
}: Props) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState(categories[0]?.slug ?? "");
  const [selected, setSelected] = useState<MenuItem | null>(null);
  // Drives the compact name in the sticky bar, once the hero is out of sight.
  const [pastHero, setPastHero] = useState(false);

  const searchInput = useRef<HTMLInputElement>(null);
  const chipRail = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  // Set while a chip tap is scrolling, so scroll-spy does not fight the jump.
  const jumpingTo = useRef<string | null>(null);
  const jumpTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(jumpTimer.current), []);

  const searching = query.trim().length > 0;

  useEffect(() => {
    function onScroll() {
      setPastHero(window.scrollY > 150);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return categories;
    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter(
          (item) =>
            item.name.toLowerCase().includes(needle) ||
            item.description.toLowerCase().includes(needle),
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, query]);

  // Highlight the chip for whichever section is under the header.
  //
  // Done by measuring on scroll rather than with an IntersectionObserver: at
  // the very top the hero fills the detection band and at the very bottom the
  // last section can never reach it, so an observer leaves the chips showing a
  // stale category at both ends of the page.
  useEffect(() => {
    if (searching) return;

    let frame = 0;

    function update() {
      frame = 0;
      if (visible.length === 0) return;

      // The line just under the sticky header — the section crossing it wins.
      const line = 140;
      let current = visible[0].slug;

      for (const category of visible) {
        const node = sectionRefs.current.get(category.slug);
        if (!node) continue;
        if (node.getBoundingClientRect().top > line) break;
        current = category.slug;
      }

      // The final section is often too short to reach the line, so once the
      // page is scrolled to the bottom it is the one being looked at.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) current = visible[visible.length - 1].slug;

      // Ignore readings taken mid-jump, or the chips flicker on the way past.
      if (jumpingTo.current && jumpingTo.current !== current) return;
      jumpingTo.current = null;
      setActiveSlug(current);
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [searching, visible]);

  // Keep the active chip in view on the rail as you scroll the page.
  useEffect(() => {
    const rail = chipRail.current;
    if (!rail || searching) return;
    const chip = rail.querySelector<HTMLElement>(`[data-chip="${activeSlug}"]`);
    if (!chip) return;

    // On the first paint the rail can still be mid-layout (width 0), and
    // centring against that scrolls the first chip half off the screen.
    if (rail.clientWidth === 0) return;

    const railBox = rail.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    const fullyVisible = chipBox.left >= railBox.left && chipBox.right <= railBox.right;
    if (fullyVisible) return;

    const centred = chip.offsetLeft - rail.clientWidth / 2 + chip.clientWidth / 2;
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    rail.scrollTo({
      left: Math.max(0, Math.min(centred, maxScroll)),
      behavior: "smooth",
    });
  }, [activeSlug, searching]);

  function jumpTo(slug: string) {
    jumpingTo.current = slug;
    setActiveSlug(slug);
    sectionRefs.current.get(slug)?.scrollIntoView({ behavior: "smooth", block: "start" });

    // The last section can be too short to ever reach the top of the viewport,
    // so the observer may never confirm the landing. Release the lock anyway,
    // otherwise the chips would stay frozen on this one.
    window.clearTimeout(jumpTimer.current);
    jumpTimer.current = window.setTimeout(() => {
      jumpingTo.current = null;
    }, 900);
  }

  function openSearch() {
    setSearchOpen(true);
    // The input mounts on the same tick; focus once it exists.
    requestAnimationFrame(() => searchInput.current?.focus());
  }

  function closeSearch() {
    setQuery("");
    setSearchOpen(false);
  }

  const itemCount = categories.reduce((total, category) => total + category.items.length, 0);

  return (
    <main className="mx-auto min-h-dvh max-w-screen-sm pb-16">
      <Backdrop appearance={appearance} />

      {offer && <OfferBanner offer={offer} />}

      <header className="sticky top-0 z-30 border-b border-[var(--line)] bar-surface backdrop-blur">
        <div className="grid h-14 grid-cols-[2.75rem_1fr_2.75rem] items-center px-2">
          <span aria-hidden="true" />

          {/* The name lives large in the hero; this compact copy fades in only
              once the hero has scrolled away, so it is never shown twice. */}
          <div
            className={`flex min-w-0 justify-center px-1 transition-opacity duration-300 ${
              pastHero || searchOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            <Wordmark name={shopName} size="bar" />
          </div>

          <button
            type="button"
            onClick={searchOpen ? closeSearch : openSearch}
            aria-label={searchOpen ? "Close search" : "Search the menu"}
            className="grid h-11 w-11 place-items-center justify-self-end rounded-full active:bg-[var(--line)]"
          >
            {searchOpen ? <CloseIcon /> : <SearchIcon />}
          </button>
        </div>

        {searchOpen && (
          <div className="animate-fadeIn px-4 pb-3">
            <input
              ref={searchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              inputMode="search"
              placeholder="Search cakes, breads, snacks…"
              className="w-full rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-base outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
            />
          </div>
        )}
      </header>

      {!searchOpen && (
        <section className="px-5 pb-7 pt-9 text-center">
          <Wordmark name={shopName} size="hero" />
          <Flourish />
          <p className="mx-auto mt-4 max-w-[19rem] text-sm leading-relaxed text-[var(--muted)]">
            {tagline}
          </p>

          {hours && hoursStatus && <OpenStatus hours={hours} initial={hoursStatus} />}
          <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
            Our Menu
          </p>
        </section>
      )}

      {!searching && categories.length > 0 && (
        <div className="sticky top-14 z-20 border-b border-[var(--line)] bar-surface py-2.5 backdrop-blur">
          <div ref={chipRail} className="no-scrollbar flex gap-2 overflow-x-auto px-4">
            {categories.map((category) => {
              const active = category.slug === activeSlug;
              return (
                <button
                  key={category.slug}
                  data-chip={category.slug}
                  type="button"
                  onClick={() => jumpTo(category.slug)}
                  aria-current={active ? "true" : undefined}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm transition-colors ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] font-semibold text-white shadow-sm"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--text)]"
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {categories.length === 0 ? (
        <EmptyState
          title="The menu is being set up"
          body="Nothing has been added yet. Please check back in a little while."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={`No matches for “${query.trim()}”`}
          body={`Try a different word — there are ${itemCount} items on the menu.`}
        />
      ) : (
        <div className="mt-4 space-y-9">
          {visible.map((category) => (
            <section
              key={category.id}
              id={category.slug}
              data-slug={category.slug}
              ref={(node) => {
                if (node) sectionRefs.current.set(category.slug, node);
                else sectionRefs.current.delete(category.slug);
              }}
              className="scroll-mt-28 px-4"
            >
              <div className="border-l-4 border-[var(--accent)] pl-3">
                <h2 className="text-xl font-bold tracking-tight">{category.name}</h2>
                {category.description && (
                  <p className="mt-0.5 text-sm text-[var(--muted)]">{category.description}</p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {category.items.map((item) => (
                  <ItemCard key={item.id} item={item} onOpen={() => setSelected(item)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Footer
        shopName={shopName}
        address={address}
        mapUrl={mapUrl}
        phone={phone}
        whatsapp={whatsapp}
        credit={credit}
      />

      {selected && (
        <ItemSheet
          item={selected}
          phone={phone}
          whatsapp={whatsapp}
          shopName={shopName}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-8 py-20 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
