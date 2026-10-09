"use client";

import Link from "next/link";
import { useState } from "react";
import {
  deleteCategory,
  moveCategory,
  toggleCategoryVisible,
  updateCategory,
} from "@/app/admin/actions";

type Category = {
  id: string;
  name: string;
  description: string;
  isVisible: boolean;
  itemCount: number;
};

export default function CategoryRow({
  category,
  isFirst,
  isLast,
  otherCategories,
}: {
  category: Category;
  isFirst: boolean;
  isLast: boolean;
  otherCategories: { id: string; name: string }[];
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");

  if (mode === "edit") {
    return (
      <form action={updateCategory} onSubmit={() => setMode("view")} className="space-y-3 p-4">
        <input type="hidden" name="id" value={category.id} />
        <div>
          <label className="label" htmlFor={`name-${category.id}`}>Category name</label>
          <input
            id={`name-${category.id}`}
            name="name"
            defaultValue={category.name}
            required
            className="field"
            autoFocus
          />
        </div>
        <div>
          <label className="label" htmlFor={`description-${category.id}`}>
            Description (shown under the heading)
          </label>
          <input
            id={`description-${category.id}`}
            name="description"
            defaultValue={category.description}
            className="field"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">Save</button>
          <button type="button" onClick={() => setMode("view")} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  if (mode === "delete") {
    return (
      <div className="space-y-3 bg-red-50/60 p-4">
        <p className="text-sm font-semibold">
          Delete “{category.name}”?
        </p>

        {category.itemCount > 0 ? (
          <>
            <p className="text-sm text-[var(--muted)]">
              It holds {category.itemCount} item{category.itemCount === 1 ? "" : "s"}. Move them
              somewhere else, or delete them along with the category.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              {otherCategories.length > 0 && (
                <form action={deleteCategory} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={category.id} />
                  <div>
                    <label className="label" htmlFor={`moveTo-${category.id}`}>
                      Move items to
                    </label>
                    <select id={`moveTo-${category.id}`} name="moveTo" className="field" required>
                      {otherCategories.map((other) => (
                        <option key={other.id} value={other.id}>{other.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="btn-ghost">Move &amp; delete category</button>
                </form>
              )}
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={category.id} />
                <button type="submit" className="btn-danger">
                  Delete category and its {category.itemCount} item
                  {category.itemCount === 1 ? "" : "s"}
                </button>
              </form>
            </div>
          </>
        ) : (
          <form action={deleteCategory}>
            <input type="hidden" name="id" value={category.id} />
            <button type="submit" className="btn-danger">Yes, delete it</button>
          </form>
        )}

        <button type="button" onClick={() => setMode("view")} className="btn-ghost">
          Cancel
        </button>
      </div>
    );
  }

  return (
    // On a phone the buttons take a line of their own, so the name keeps the
    // full width instead of breaking one word per line beside them.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
      <div className="flex flex-col">
        <MoveButton id={category.id} direction="up" disabled={isFirst} />
        <MoveButton id={category.id} direction="down" disabled={isLast} />
      </div>

      <div className="min-w-0 flex-1">
        <Link href={`/admin/categories/${category.id}`} className="font-semibold hover:underline">
          {category.name}
        </Link>
        {!category.isVisible && (
          <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-neutral-700">
            Hidden
          </span>
        )}
        <p className="truncate text-sm text-[var(--muted)]">
          {category.itemCount} item{category.itemCount === 1 ? "" : "s"}
          {category.description ? ` · ${category.description}` : ""}
        </p>
      </div>

      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <form action={toggleCategoryVisible}>
          <input type="hidden" name="id" value={category.id} />
          <button
            type="submit"
            className="btn-ghost"
            title={category.isVisible ? "Hide from customers" : "Show to customers"}
          >
            {category.isVisible ? "Hide" : "Show"}
          </button>
        </form>

        <button type="button" onClick={() => setMode("edit")} className="btn-ghost">
          Rename
        </button>
        <button type="button" onClick={() => setMode("delete")} className="btn-danger">
          Delete
        </button>
      </div>
    </div>
  );
}

function MoveButton({
  id,
  direction,
  disabled,
}: {
  id: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  return (
    <form action={moveCategory}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={`Move ${direction}`}
        className="px-1 text-xs text-[var(--muted)] disabled:opacity-25"
      >
        {direction === "up" ? "▲" : "▼"}
      </button>
    </form>
  );
}
