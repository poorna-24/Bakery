"use client";

import { useFormStatus } from "react-dom";
import { WEEKDAYS } from "@/lib/hours";
import { saveHours } from "@/app/actions";

export default function HoursForm({
  open,
  close,
  closedDays,
  isSet,
}: {
  open: string;
  close: string;
  closedDays: number[];
  isSet: boolean;
}) {
  return (
    <form action={saveHours} className="mt-6 max-w-2xl">
      <div className="card space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="open">Opens at</label>
            <input id="open" name="open" type="time" defaultValue={open} required className="field" />
          </div>
          <div>
            <label className="label" htmlFor="close">Closes at</label>
            <input id="close" name="close" type="time" defaultValue={close} required className="field" />
          </div>
        </div>

        <div>
          <p className="label">Weekly off</p>
          <p className="mb-2 text-xs text-[var(--muted)]">
            Tick any day the shop stays shut. Leave all unticked if you open every day.
          </p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label
                key={day.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="closedDays"
                  value={day.value}
                  defaultChecked={closedDays.includes(day.value)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                {day.short}
              </label>
            ))}
          </div>
        </div>
      </div>

      <SaveBar isSet={isSet} />
    </form>
  );
}

function SaveBar({ isSet }: { isSet: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : "Save hours"}
      </button>

      {isSet && (
        <button
          type="submit"
          name="clear"
          value="1"
          disabled={pending}
          className="btn-ghost"
          // Not a destructive action — it just takes the badge off the menu.
          title="Remove the open/closed badge from the customer menu"
        >
          Hide the badge
        </button>
      )}

      <a href="/preview" className="btn-ghost">Preview on a phone</a>
    </div>
  );
}
