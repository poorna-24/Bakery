"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { BACKGROUNDS, type BackgroundId } from "@/lib/backgrounds";
import { removeBackgroundImage, saveAppearance } from "@/app/actions";

/**
 * A gallery rather than a toggle: a switch can only say on or off, and the
 * owner needs to say *which* background. "Plain" is the off position.
 *
 * Each swatch is painted by the very CSS class the customer page will use, so
 * what is shown here is the real thing, not an approximation of it.
 */
export default function BackgroundPicker({
  selected,
  uploadedImageUrl,
}: {
  selected: BackgroundId;
  uploadedImageUrl: string | null;
}) {
  const [choice, setChoice] = useState<BackgroundId>(selected);
  const [preview, setPreview] = useState<string | null>(uploadedImageUrl);

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setChoice("custom");
  }

  return (
    <form action={saveAppearance} className="mt-6">
      <input type="hidden" name="backgroundId" value={choice} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BACKGROUNDS.map((option) => {
          const active = choice === option.id;
          const isCustom = option.id === "custom";

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setChoice(option.id)}
              aria-pressed={active}
              className={`overflow-hidden rounded-xl border-2 text-left transition-colors ${
                active
                  ? "border-[var(--accent)] tint-accent"
                  : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--muted)]"
              }`}
            >
              <div className="relative h-28 border-b border-[var(--line)] bg-[#fdf6ec]">
                {isCustom ? (
                  preview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="" className="h-full w-full object-cover" />
                      {/* The same scrim the customer page puts over it. */}
                      <span className="absolute inset-0 bg-[#fdf6ec]/[0.88]" />
                    </>
                  ) : (
                    <span className="grid h-full w-full place-items-center text-sm text-[var(--muted)]">
                      No photo yet
                    </span>
                  )
                ) : (
                  <span className={`absolute inset-0 ${option.className}`} />
                )}

                {/* A card floats on the swatch, the way the menu cards will. */}
                <span className="absolute bottom-2 left-2 rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-[11px] font-semibold text-[#3a2418] shadow-sm">
                  ₹350 – ₹650
                </span>

                {active && (
                  <span className="absolute right-2 top-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-white">
                    Selected
                  </span>
                )}
              </div>

              <div className="p-3">
                <p className="text-sm font-semibold">{option.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="card mt-6 p-4">
        <p className="label">Upload your own photo</p>
        <input
          type="file"
          name="backgroundImage"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={pickFile}
          className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        <p className="mt-2 text-xs text-[var(--muted)]">
          Up to 5 MB. A wide photo of the shop or the counter works best — it is dimmed behind the
          menu so the prices stay easy to read. Uploading one selects “Your own photo”
          automatically.
        </p>

        {uploadedImageUrl && (
          <button
            type="submit"
            formAction={removeBackgroundImage}
            className="btn-danger mt-3"
          >
            Remove uploaded photo
          </button>
        )}
      </div>

      <SaveBar />
    </form>
  );
}

function SaveBar() {
  const { pending } = useFormStatus();

  return (
    <div className="mt-6 flex items-center gap-3">
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : "Save background"}
      </button>
      <a href="/preview" className="btn-ghost">Preview on a phone</a>
    </div>
  );
}
