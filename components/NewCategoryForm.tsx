"use client";

import { useRef, useState } from "react";
import { createCategory } from "@/app/actions";

export default function NewCategoryForm() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary mt-4">
        + New category
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createCategory(formData);
        formRef.current?.reset();
      }}
      className="card mt-4 space-y-3 p-4"
    >
      <div>
        <label className="label">Category name</label>
        <input
          name="name"
          required
          autoFocus
          placeholder="e.g. Chocolate Delights"
          className="field"
        />
      </div>
      <div>
        <label className="label">Description (optional)</label>
        <input
          name="description"
          placeholder="One line shown under the heading on the menu"
          className="field"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">Add category</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
