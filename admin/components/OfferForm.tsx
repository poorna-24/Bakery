"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  MAX_OFFER_NOTE,
  MAX_OFFER_TEXT,
  OFFER_TONES,
  offerToneClass,
  type Offer,
  type OfferTone,
} from "@/lib/offer";
import { removeOffer, saveOffer } from "@/app/actions";

export default function OfferForm({ draft, exists }: { draft: Offer; exists: boolean }) {
  const [text, setText] = useState(draft.text);
  const [note, setNote] = useState(draft.note);
  const [tone, setTone] = useState<OfferTone>(draft.tone);
  const [visible, setVisible] = useState(draft.isVisible);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  return (
    <form action={saveOffer} className="mt-6 max-w-2xl">
      <input type="hidden" name="tone" value={tone} />

      {/* Exactly what the customer will see, in the colour chosen below. */}
      <div>
        <p className="label">Preview</p>
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          {text.trim() ? (
            <div className={`px-4 py-3 text-center ${offerToneClass(tone)}`}>
              <p className="text-sm font-bold leading-snug tracking-tight">{text}</p>
              {note.trim() && <p className="mt-0.5 text-xs opacity-90">{note}</p>}
            </div>
          ) : (
            <p className="bg-[var(--bg)] px-4 py-6 text-center text-sm text-[var(--muted)]">
              Nothing yet — type below and it appears here.
            </p>
          )}
          <p className="bg-white px-4 py-2 text-center text-[11px] text-[var(--muted)]">
            ↑ sits above the shop name on the menu
          </p>
        </div>
        {!visible && text.trim() && (
          <p className="mt-2 text-xs font-medium text-[var(--danger)]">
            Hidden — customers will not see this until you tick “Show on the menu”.
          </p>
        )}
      </div>

      <div className="card mt-5 space-y-4 p-4">
        <div>
          <label className="label" htmlFor="text">
            Offer text <span className="font-normal normal-case">(one short line)</span>
          </label>
          <input
            id="text"
            name="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={MAX_OFFER_TEXT}
            required
            placeholder="Diwali special — 20% off all sweets"
            className="field"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            {text.length}/{MAX_OFFER_TEXT} — keep it short so it fits one line on a phone.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="note">Second line (optional)</label>
          <input
            id="note"
            name="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={MAX_OFFER_NOTE}
            placeholder="Till 5 November, on orders above ₹500"
            className="field"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            {note.length}/{MAX_OFFER_NOTE} — dates or conditions.
          </p>
        </div>

        <div>
          <p className="label">Colour</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {OFFER_TONES.map((option) => {
              const active = tone === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTone(option.id)}
                  aria-pressed={active}
                  className={`flex items-start gap-3 rounded-lg border-2 p-2.5 text-left transition-colors ${
                    active ? "border-[var(--accent)] tint-accent" : "border-[var(--line)] bg-white"
                  }`}
                >
                  <span className={`mt-0.5 h-8 w-8 shrink-0 rounded ${option.className}`} />
                  <span>
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="block text-xs leading-snug text-[var(--muted)]">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--line)] p-3">
          <input
            type="checkbox"
            name="isVisible"
            checked={visible}
            onChange={(event) => setVisible(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            <span className="text-sm font-medium">Show on the menu</span>
            <span className="block text-xs text-[var(--muted)]">
              Untick to hide it and keep the text for next time.
            </span>
          </span>
        </label>
      </div>

      <SaveBar exists={exists} confirming={confirmingRemove} onConfirm={setConfirmingRemove} />
    </form>
  );
}

function SaveBar({
  exists,
  confirming,
  onConfirm,
}: {
  exists: boolean;
  confirming: boolean;
  onConfirm: (value: boolean) => void;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : "Save offer"}
      </button>

      {exists &&
        (confirming ? (
          <>
            <span className="text-sm text-[var(--muted)]">Delete the text as well?</span>
            <button type="submit" formAction={removeOffer} disabled={pending} className="btn-danger">
              Yes, remove it
            </button>
            <button type="button" onClick={() => onConfirm(false)} className="btn-ghost">
              Cancel
            </button>
          </>
        ) : (
          <button type="button" onClick={() => onConfirm(true)} className="btn-danger">
            Remove offer
          </button>
        ))}

      <a href="/preview" className="btn-ghost">Preview on a phone</a>
    </div>
  );
}
