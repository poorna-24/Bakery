"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createItem, updateItem } from "@/app/actions";
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

  function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setRemoveImage(false);
  }

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
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg)]">
            {preview && !removeImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl opacity-30">🧁</span>
            )}
          </div>

          <div className="space-y-2">
            <input
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={pickImage}
              className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            <p className="text-xs text-[var(--muted)]">
              JPG, PNG, WebP or AVIF · up to 5 MB · square photos look best on the menu.
            </p>
            {values.imageUrl && !removeImage && (
              <button
                type="button"
                onClick={() => {
                  setRemoveImage(true);
                  setPreview(null);
                }}
                className="text-xs font-medium text-[var(--danger)] hover:underline"
              >
                Remove current photo
              </button>
            )}
            {removeImage && (
              <p className="text-xs text-[var(--danger)]">
                Photo will be removed when you save.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setRemoveImage(false);
                    setPreview(values.imageUrl);
                  }}
                  className="font-medium underline"
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

function SubmitBar({ editing, categoryId }: { editing: boolean; categoryId: string }) {
  // Uploading a photo takes a moment; disable the button so it is not sent twice.
  const { pending } = useFormStatus();

  return (
    <div className="flex items-center gap-3">
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : editing ? "Save changes" : "Add item"}
      </button>
      <a href={`/categories/${categoryId}`} className="btn-ghost">Cancel</a>
    </div>
  );
}
