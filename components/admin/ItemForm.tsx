"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createItem, updateItem } from "@/app/admin/actions";
import { UNITS } from "@/lib/types";

type Variant = { label: string; price: string };

export type ItemFormValues = {
  id?: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  imageUrl: string | null;
  isVeg: boolean;
  isEggless: boolean;
  isBestseller: boolean;
  isAvailable: boolean;
  variants: { label: string; price: number }[];
};

export default function ItemForm({
  values,
  categories,
  error,
}: {
  values: ItemFormValues;
  categories: { id: string; name: string }[];
  error?: string;
}) {
  const editing = Boolean(values.id);

  const [variants, setVariants] = useState<Variant[]>(
    values.variants.map((variant) => ({ label: variant.label, price: String(variant.price) })),
  );
  const [preview, setPreview] = useState<string | null>(values.imageUrl);
  const [removeImage, setRemoveImage] = useState(false);
  const [source, setSource] = useState<"file" | "link">("file");
  const [link, setLink] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function chooseFile(file: File | undefined) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setFileName(file.name);
    setRemoveImage(false);
    // Only one source can win; clear the other so the form matches what will
    // actually be saved.
    setLink("");
  }

  function dropFile(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/") || !fileInput.current) return;
    // A drop does not fill the input by itself, and the input is what the
    // form submits — so hand the file over explicitly.
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.current.files = transfer.files;
    chooseFile(file);
  }

  function pasteLink(value: string) {
    setLink(value);
    setRemoveImage(false);
    // A chosen file beats a link on the server, so drop it — otherwise the
    // preview would show the link and the save would quietly use the file.
    if (fileInput.current) fileInput.current.value = "";
    setFileName(null);
    // Show it straight away — a typo is obvious the moment nothing appears.
    setPreview(value.trim() ? value.trim() : values.imageUrl);
  }

  const photoStatus = removeImage
    ? "Will be removed when you save"
    : fileName || link.trim()
      ? "New photo · not saved yet"
      : values.imageUrl
        ? "Current photo"
        : "No photo yet";

  return (
    <form action={editing ? updateItem : createItem} className="space-y-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      {removeImage && <input type="hidden" name="removeImage" value="on" />}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
      )}

      <div className="card space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="categoryId">Category</label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={values.categoryId}
              required
              className="field"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="name">Item name</label>
            <input
              id="name"
              name="name"
              defaultValue={values.name}
              required
              placeholder="e.g. Choco Truffle Cake"
              className="field"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="description">Description (optional)</label>
          <textarea
            id="description"
            name="description"
            defaultValue={values.description}
            rows={2}
            placeholder="Rich Belgian chocolate sponge with truffle cream"
            className="field resize-y"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="price">Price (₹)</label>
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={values.price || ""}
              required
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="unit">Sold as</label>
            <select id="unit" name="unit" defaultValue={values.unit} className="field">
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <p className="label">Photo</p>
        <div className="flex flex-wrap items-start gap-5">
          <div className="w-32 shrink-0 space-y-1.5">
            <div className="grid h-32 w-32 place-items-center overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg)]">
              {preview && !removeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-4xl opacity-30">🧁</span>
              )}
            </div>
            <p
              className={`text-center text-xs font-medium ${
                removeImage ? "text-[var(--danger)]" : "text-[var(--muted)]"
              }`}
            >
              {photoStatus}
            </p>
          </div>

          <div className="min-w-[16rem] flex-1 space-y-3">
            {/* A toggle, not two buttons: the chosen side is a raised white
                chip, so it cannot be mistaken for an action to click. */}
            <div
              role="group"
              aria-label="Where the photo comes from"
              className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--bg)] p-1 ring-1 ring-inset ring-[var(--line)] sm:inline-grid"
            >
              {(["file", "link"] as const).map((option) => {
                const active = source === option;
                const Icon = option === "file" ? UploadIcon : LinkIcon;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSource(option)}
                    aria-pressed={active}
                    className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                      active
                        ? "bg-white text-[var(--text)] shadow-sm ring-1 ring-[var(--line)]"
                        : "text-[var(--muted)] hover:bg-white/60 hover:text-[var(--text)]"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-[var(--accent)]" : ""}`} />
                    {option === "file" ? "Upload a file" : "Paste a link"}
                  </button>
                );
              })}
            </div>

            {/* Both inputs stay mounted so a half-filled one is not lost when
                the owner flicks between them; only the active one is shown. */}
            <div className={source === "file" ? "" : "hidden"}>
              <label
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={dropFile}
                className={`group flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-2.5 transition focus-within:ring-2 focus-within:ring-[var(--accent)] ${
                  dragging
                    ? "border-[var(--accent)] bg-amber-50"
                    : "border-[var(--line)] hover:border-[var(--accent)] hover:bg-amber-50/40"
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-[var(--accent)] transition group-hover:bg-amber-100">
                  {fileName ? <CheckIcon className="h-4 w-4" /> : <UploadIcon className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  {fileName ? (
                    <>
                      <span className="block truncate text-sm font-semibold">{fileName}</span>
                      <span className="text-xs text-[var(--muted)]">Click to pick a different photo</span>
                    </>
                  ) : (
                    <>
                      <span className="block text-sm font-semibold">
                        <span className="text-[var(--accent)]">Choose a photo</span>
                        <span className="font-normal text-[var(--muted)]"> or drag it here</span>
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        JPG, PNG, WebP or AVIF · up to 5 MB
                      </span>
                    </>
                  )}
                </span>
                <span className="hidden shrink-0 rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] shadow-sm transition group-hover:border-[var(--accent)] sm:inline">
                  Browse
                </span>
                <input
                  ref={fileInput}
                  type="file"
                  name="image"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={(event) => chooseFile(event.target.files?.[0])}
                  className="sr-only"
                />
              </label>
            </div>

            <div className={source === "link" ? "space-y-2" : "hidden"}>
              <div className="relative">
                <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="url"
                  name="imageLink"
                  value={link}
                  onChange={(event) => pasteLink(event.target.value)}
                  placeholder="https://example.com/cake.jpg"
                  className="field py-2.5 pl-9"
                />
              </div>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-[var(--text)]">
                <strong>Tip:</strong> in Google Images, click the picture to open
                it, then right-click it and choose <strong>Copy image address</strong>.
                The picture is copied into your own storage, so it keeps working
                even if the original page changes.
              </p>
            </div>

            {values.imageUrl && !removeImage && (
              <button
                type="button"
                onClick={() => {
                  setRemoveImage(true);
                  setPreview(null);
                }}
                className="btn-danger px-3 py-1.5 text-xs"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Remove current photo
              </button>
            )}
            {removeImage && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-[var(--danger)]">
                Photo will be removed when you save.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setRemoveImage(false);
                    setPreview(values.imageUrl);
                  }}
                  className="font-semibold underline"
                >
                  Undo
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-2">
        <Toggle name="isVeg" label="Vegetarian" defaultChecked={values.isVeg} />
        <Toggle name="isEggless" label="Eggless" defaultChecked={values.isEggless} />
        <Toggle name="isBestseller" label="Bestseller (★ badge)" defaultChecked={values.isBestseller} />
        <Toggle
          name="isAvailable"
          label="Available today"
          defaultChecked={values.isAvailable}
          hint="Turn off to show it as Sold out without removing it."
        />
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="label mb-0">Sizes / variants (optional)</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              For things sold by weight. Add these and the menu shows a price range instead of the
              single price above.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVariants([...variants, { label: "", price: "" }])}
            className="btn-ghost"
          >
            + Add size
          </button>
        </div>

        {variants.length > 0 && (
          <div className="mt-4 space-y-2">
            {variants.map((variant, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  name="variantLabel"
                  value={variant.label}
                  onChange={(event) => {
                    const next = [...variants];
                    next[index] = { ...next[index], label: event.target.value };
                    setVariants(next);
                  }}
                  placeholder="500 g"
                  className="field flex-1"
                />
                <input
                  name="variantPrice"
                  value={variant.price}
                  onChange={(event) => {
                    const next = [...variants];
                    next[index] = { ...next[index], price: event.target.value };
                    setVariants(next);
                  }}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="450"
                  className="field w-32"
                />
                <button
                  type="button"
                  onClick={() => setVariants(variants.filter((_, i) => i !== index))}
                  aria-label="Remove size"
                  className="btn-danger px-3"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <SubmitBar editing={editing} categoryId={values.categoryId} />
    </form>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
  hint,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--line)] p-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
      />
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-[var(--muted)]">{hint}</span>}
      </span>
    </label>
  );
}

// Small line icons for the photo box. Decorative only — every one sits next to
// text that already says what it means.
function Icon({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
    </Icon>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </Icon>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M5 12l5 5 9-10" />
    </Icon>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Icon>
  );
}

function SubmitBar({ editing, categoryId }: { editing: boolean; categoryId: string }) {
  // Uploading a photo takes a moment; disable the button so it is not sent twice.
  const { pending } = useFormStatus();

  return (
    <div className="flex items-center gap-3">
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : editing ? "Save changes" : "Add item"}
      </button>
      <a href={`/admin/categories/${categoryId}`} className="btn-ghost">Cancel</a>
    </div>
  );
}
