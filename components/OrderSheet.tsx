"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/types";
import { shopNow, shopStatus, type ShopHours } from "@/lib/hours";
import {
  MODE_LABELS,
  WHEN_OPTIONS,
  cartTotal,
  mapsLink,
  needsPhone,
  needsTime,
  newOrderId,
  orderLink,
  orderMessage,
  orderProblem,
  orderingClosed,
  paymentLabel,
  upiLink,
  type Cart,
  type OrderDetails,
  type OrderingConfig,
} from "@/lib/ordering";
import { submitOrder } from "@/app/order-actions";
import type { PlaceOrderResult } from "@/lib/placeOrder";
import QtyStepper from "./QtyStepper";
import { WhatsAppIcon } from "./Footer";

type Props = {
  config: OrderingConfig;
  cart: Cart;
  shopName: string;
  hours: ShopHours | null;
  onChange: (key: string, delta: number) => void;
  onClose: () => void;
  /** The order went off to WhatsApp and the customer is done: empty the cart. */
  onDone: () => void;
  /** Saves the order for the dashboard. Swappable so tests need no server. */
  submit?: (body: unknown) => Promise<PlaceOrderResult>;
};

type Sent = {
  code: string;
  link: string;
  total: number;
  /** False when the shop could not be reached and the order went to WhatsApp only. */
  saved: boolean;
  /** UPI payers pay first, then send — WhatsApp is not opened for them automatically. */
  payByUpi: boolean;
};

type Locating = { state: "idle" } | { state: "busy" } | { state: "failed"; message: string };

export default function OrderSheet({
  config,
  cart,
  shopName,
  hours,
  onChange,
  onClose,
  onDone,
  submit = submitOrder,
}: Props) {
  const [details, setDetails] = useState<OrderDetails>({
    mode: config.modes[0],
    table: "",
    name: "",
    phone: "",
    address: "",
    when: WHEN_OPTIONS[0],
    note: "",
    // One way to pay needs no question.
    payment: config.payments.length === 1 ? config.payments[0] : "",
    location: null,
  });
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const [locating, setLocating] = useState<Locating>({ state: "idle" });
  const [sent, setSent] = useState<Sent | null>(null);

  // Freeze the page behind the sheet, and let Escape close it.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  // Worked out now rather than at page load: the menu may have been open a
  // while, and the shop may have opened or shut since.
  const status = hours ? shopStatus(hours, shopNow()) : null;
  // The status line to show when orders are refused because the shop is shut.
  const closedDetail = status && orderingClosed(config, status) ? status.detail : null;
  const total = cartTotal(cart);
  const short = config.minOrder - total;
  const upiReady = Boolean(config.upiId || config.upiQr);

  function update(change: Partial<OrderDetails>) {
    setDetails((current) => ({ ...current, ...change }));
    setProblem(null);
  }

  function shareLocation() {
    if (!("geolocation" in navigator)) {
      setLocating({ state: "failed", message: "This phone can't share its location." });
      return;
    }
    setLocating({ state: "busy" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update({ location: { lat: position.coords.latitude, lng: position.coords.longitude } });
        setLocating({ state: "idle" });
      },
      () =>
        setLocating({
          state: "failed",
          message: "Couldn't get your location. Allow location for this site and try again.",
        }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  /** Opens WhatsApp — straight away, unless the customer still has to pay by UPI. */
  function finish(code: string, orderCart: Cart, orderTotal: number, saved: boolean) {
    const link = orderLink(config.whatsapp, orderMessage({ shopName, orderId: code, cart: orderCart, details }));
    const payByUpi = details.payment === "upi" && upiReady;
    if (!payByUpi) window.open(link, "_blank", "noopener,noreferrer");
    setSent({ code, link, total: orderTotal, saved, payByUpi });
  }

  async function send() {
    const reason = orderProblem(config, cart, details);
    if (reason) {
      setProblem(reason);
      return;
    }

    setSending(true);
    try {
      const result = await submit({
        lines: cart.map((line) => ({ itemId: line.itemId, size: line.size, qty: line.qty })),
        details,
      });
      if (result.ok) finish(result.code, result.cart, result.total, true);
      else setProblem(result.error);
    } catch {
      setProblem("Couldn't reach the shop. Check your connection and try again.");
      setUnreachable(true);
    } finally {
      setSending(false);
    }
  }

  const nameRequired = details.mode !== "table";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Your order"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 animate-fadeIn bg-black/50"
      />

      <div className="relative max-h-[92dvh] w-full max-w-screen-sm animate-sheetUp overflow-y-auto rounded-t-3xl bg-[var(--surface)] pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 z-10 flex justify-center bg-[var(--surface)] pb-1 pt-3">
          <span className="h-1.5 w-11 rounded-full bg-[var(--line)]" />
        </div>

        {sent ? (
          <div className="px-4 pb-6 pt-1 text-center sm:px-5 sm:pb-8 sm:pt-3">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-700 sm:h-14 sm:w-14">
              <WhatsAppIcon />
            </div>
            <h2 className="mt-2 text-xl font-bold sm:mt-3">Order #{sent.code}</h2>
            {!sent.saved && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Sent without reaching the shop&apos;s list — the shop still gets it on WhatsApp.
              </p>
            )}

            {sent.payByUpi ? (
              // Phones: stacked, pay above send — the order to do them in. Wider
              // screens have the room to put the two steps side by side.
              <div className="mt-3 grid gap-2.5 text-left sm:mt-4 sm:grid-cols-2 sm:gap-3">
                <div className="rounded-2xl border border-[var(--line)] p-3.5 sm:p-4">
                  <p className="text-sm font-bold">Step 1 · Pay {formatPrice(sent.total)} by UPI</p>
                  {config.upiId && (
                    <>
                      <a
                        href={upiLink({ upiId: config.upiId, payee: shopName, amount: sent.total, code: sent.code })}
                        className="mt-3 flex w-full items-center justify-center rounded-xl bg-[var(--accent)] py-3 text-sm font-bold text-white"
                      >
                        Pay {formatPrice(sent.total)} with a UPI app
                      </a>
                      <p className="mt-2 text-center text-xs text-[var(--muted)]">
                        Opens GPay, PhonePe or Paytm · UPI ID <strong className="select-all">{config.upiId}</strong>
                      </p>
                    </>
                  )}
                  {config.upiQr && (
                    <div className="mt-3 text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={config.upiQr}
                        alt={`UPI QR code for ${shopName}`}
                        className="mx-auto h-36 w-36 rounded-xl border border-[var(--line)] bg-white object-contain p-1 sm:h-44 sm:w-44"
                      />
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Or scan this from another phone — or save it and pick it in your UPI app.
                      </p>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-[var(--line)] p-3.5 sm:p-4">
                  <p className="text-sm font-bold">Step 2 · Send your order</p>
                  <a
                    href={sent.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#15803d] py-3 text-sm font-bold text-white"
                  >
                    <WhatsAppIcon />
                    Send order on WhatsApp
                  </a>
                </div>
              </div>
            ) : (
              <>
                <p className="mx-auto mt-2 max-w-[19rem] text-sm text-[var(--muted)]">
                  Your order is typed into WhatsApp.{" "}
                  <strong className="text-[var(--text)]">Tap send there</strong> to place it — we&apos;ll
                  confirm in the chat.
                </p>
                <a
                  href={sent.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] py-3 text-sm font-semibold"
                >
                  WhatsApp didn&apos;t open? Try again
                </a>
              </>
            )}

            <button
              type="button"
              onClick={onDone}
              className="mt-3 w-full rounded-xl border border-[var(--line)] py-3 text-sm font-bold"
            >
              Done — start a new order
            </button>
          </div>
        ) : cart.length === 0 ? (
          <div className="px-5 pb-10 pt-6 text-center">
            <p className="text-lg font-semibold">Your order is empty</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Add something from the menu first.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-xl border border-[var(--line)] px-5 py-2.5 text-sm font-semibold"
            >
              Back to the menu
            </button>
          </div>
        ) : (
          <div className="space-y-5 px-5 pb-8 pt-2">
            <h2 className="text-xl font-bold">Your order</h2>

            <ul className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] px-3">
              {cart.map((line) => {
                const label = line.size ? `${line.name} (${line.size})` : line.name;
                return (
                  <li key={line.key} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{line.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {line.size ? `${line.size} · ` : ""}
                        {formatPrice(line.price)} each
                      </p>
                    </div>
                    <QtyStepper qty={line.qty} label={label} onChange={(delta) => onChange(line.key, delta)} />
                    <span className="w-16 text-right text-sm font-semibold">
                      {formatPrice(line.price * line.qty)}
                    </span>
                  </li>
                );
              })}
              <li className="flex justify-between py-3 font-bold">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </li>
            </ul>

            {short > 0 && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                The minimum order is {formatPrice(config.minOrder)}. Add {formatPrice(short)} more.
              </p>
            )}

            {config.modes.length > 1 && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Where are you?</legend>
                <div className="grid grid-cols-2 gap-2">
                  {config.modes.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => update({ mode })}
                      aria-pressed={details.mode === mode}
                      className={`rounded-xl border p-3 text-left ${
                        details.mode === mode
                          ? "border-2 border-[var(--accent)] bg-[var(--bg)]"
                          : "border-[var(--line)]"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{MODE_LABELS[mode].title}</span>
                      <span className="block text-xs text-[var(--muted)]">{MODE_LABELS[mode].hint}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="space-y-3">
              {details.mode === "table" && (
                <label className="block text-sm font-semibold">
                  Table number
                  <select
                    value={details.table}
                    onChange={(event) => update({ table: event.target.value })}
                    className="order-field mt-1"
                  >
                    <option value="">Choose your table</option>
                    {Array.from({ length: config.tables }, (_, index) => (
                      <option key={index + 1} value={String(index + 1)}>
                        Table {index + 1}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block text-sm font-semibold">
                {nameRequired ? "Your name" : "Your name (optional)"}
                <input
                  value={details.name}
                  onChange={(event) => update({ name: event.target.value })}
                  autoComplete="name"
                  placeholder="Ravi"
                  className="order-field mt-1"
                />
              </label>

              {needsPhone(details.mode) && (
                <label className="block text-sm font-semibold">
                  Phone number
                  <input
                    value={details.phone}
                    onChange={(event) => update({ phone: event.target.value })}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="98765 43210"
                    className="order-field mt-1"
                  />
                </label>
              )}

              {details.mode === "delivery" && (
                <>
                  <label className="block text-sm font-semibold">
                    Delivery address
                    <textarea
                      value={details.address}
                      onChange={(event) => update({ address: event.target.value })}
                      autoComplete="street-address"
                      rows={2}
                      placeholder="House no., street, landmark"
                      className="order-field mt-1 resize-y"
                    />
                  </label>

                  <div className="rounded-xl border border-[var(--line)] p-3">
                    <p className="text-sm font-semibold">Your location</p>
                    {details.location ? (
                      <p className="mt-1 text-sm text-emerald-700">
                        ✓ Location added ·{" "}
                        <a
                          href={mapsLink(details.location)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          check on map
                        </a>{" "}
                        ·{" "}
                        <button type="button" onClick={() => update({ location: null })} className="underline">
                          remove
                        </button>
                      </p>
                    ) : (
                      <>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          Needed so the delivery reaches the right door.
                        </p>
                        <button
                          type="button"
                          onClick={shareLocation}
                          disabled={locating.state === "busy"}
                          className="mt-2 w-full rounded-xl border border-[var(--accent)] py-2.5 text-sm font-bold text-[var(--accent)] disabled:opacity-60"
                        >
                          {locating.state === "busy" ? "Finding you…" : "📍 Share my location"}
                        </button>
                        {locating.state === "failed" && (
                          <p className="mt-2 text-xs text-red-700">{locating.message}</p>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}

              {needsTime(details.mode) && (
                <label className="block text-sm font-semibold">
                  When
                  <select
                    value={details.when}
                    onChange={(event) => update({ when: event.target.value })}
                    className="order-field mt-1"
                  >
                    {WHEN_OPTIONS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
              )}

              {config.payments.length > 0 && (
                <label className="block text-sm font-semibold">
                  How will you pay?
                  <select
                    value={details.payment}
                    onChange={(event) => update({ payment: event.target.value })}
                    className="order-field mt-1"
                  >
                    {config.payments.length > 1 && <option value="">Choose a way to pay</option>}
                    {config.payments.map((method) => (
                      <option key={method} value={method}>
                        {paymentLabel(method, details.mode)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block text-sm font-semibold">
                Note (optional)
                <textarea
                  value={details.note}
                  onChange={(event) => update({ note: event.target.value })}
                  rows={2}
                  placeholder="Less sugar, pack it to go, a message on the cake…"
                  className="order-field mt-1 resize-y"
                />
              </label>
            </div>

            {problem && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {problem}
              </p>
            )}

            {closedDetail !== null ? (
              <p className="rounded-xl bg-[var(--bg)] px-3 py-3 text-center text-sm">
                <strong>We&apos;re closed right now</strong>
                <span className="block text-[var(--muted)]">
                  {closedDetail} · you can send your order once we&apos;re open.
                </span>
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={send}
                  disabled={sending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#15803d] py-3.5 text-base font-bold text-white disabled:opacity-60"
                >
                  <WhatsAppIcon />
                  {sending ? "Placing your order…" : "Send order on WhatsApp"}
                </button>
                {unreachable && (
                  <button
                    type="button"
                    onClick={() => finish(newOrderId(), cart, total, false)}
                    className="w-full py-1 text-sm text-[var(--muted)] underline"
                  >
                    Send it on WhatsApp anyway
                  </button>
                )}
              </>
            )}
            <p className="-mt-2 text-center text-xs text-[var(--muted)]">
              Opens WhatsApp with your order typed in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
