import { saveOrdering } from "@/app/admin/actions";
import {
  MAX_TABLES,
  MODE_LABELS,
  ORDER_MODES,
  PAYMENT_METHODS,
  paymentLabel,
  type OrderMode,
  type OrderingSettings,
} from "@/lib/ordering";

const MODE_HELP: Record<OrderMode, string> = {
  table: "Customers sitting down pick their table number. You get “TABLE 3” on WhatsApp.",
  counter: "Customers standing at the counter give their name and phone number, so you can call them.",
  pickup: "Order now, collect later. Asks for a name, a phone number and a time.",
  delivery:
    "Asks for a name, phone number, address, their shared location and a time. Off means no delivery option at all.",
};

/** The WhatsApp ordering switches. Plain form: saves through a server action, no client JS needed. */
export default function OrderingForm({
  settings,
  fallbackNumber,
}: {
  settings: OrderingSettings;
  /** The shop's own WhatsApp number from the environment, used when none is set here. */
  fallbackNumber: string;
}) {
  return (
    <form action={saveOrdering} className="mt-6 max-w-2xl space-y-5">
      <label className="card flex cursor-pointer items-start gap-3 p-4">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={settings.enabled}
          className="mt-1 h-5 w-5 accent-[var(--accent)]"
        />
        <span>
          <span className="block font-semibold">Take orders on WhatsApp</span>
          <span className="block text-sm text-[var(--muted)]">
            On: the menu gets two tabs — <strong>Menu</strong> and <strong>Order on WhatsApp</strong>.
            Off: customers see the menu only, exactly as before.
          </span>
        </span>
      </label>

      <fieldset className="card space-y-3 p-4">
        <legend className="label px-1">Ways to order</legend>
        {ORDER_MODES.map((mode) => (
          <div key={mode} className="rounded-lg border border-[var(--line)] p-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                name={mode}
                defaultChecked={settings.modes[mode]}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                <span className="block text-sm font-semibold">{MODE_LABELS[mode].title}</span>
                <span className="block text-xs text-[var(--muted)]">{MODE_HELP[mode]}</span>
              </span>
            </label>

            {mode === "table" && (
              <label className="ml-6 mt-2 flex items-center gap-2 text-sm">
                Number of tables
                <input
                  type="number"
                  name="tables"
                  min={1}
                  max={MAX_TABLES}
                  defaultValue={settings.tables || ""}
                  className="field w-24"
                />
              </label>
            )}
          </div>
        ))}
      </fieldset>

      <div className="card space-y-4 p-4">
        <div>
          <label className="label" htmlFor="whatsapp">Send orders to (WhatsApp number)</label>
          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            defaultValue={settings.whatsapp}
            placeholder={fallbackNumber || "+91 98765 43210"}
            className="field"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            {fallbackNumber
              ? `Leave empty to use the shop's number, ${fallbackNumber}.`
              : "Include the country code. Orders arrive on this number's WhatsApp."}
          </p>
        </div>

        <div>
          <label className="label" htmlFor="minOrder">Minimum order (₹)</label>
          <input
            id="minOrder"
            name="minOrder"
            type="number"
            min={0}
            defaultValue={settings.minOrder || ""}
            placeholder="0"
            className="field w-32"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">Leave empty or 0 for no minimum.</p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            name="onlyWhenOpen"
            defaultChecked={settings.onlyWhenOpen}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            <span className="block text-sm font-semibold">Only accept orders while the shop is open</span>
            <span className="block text-xs text-[var(--muted)]">
              Uses your <a href="/admin/hours" className="underline">Shop hours</a>. Customers can
              still look and build an order; sending waits until you open.
            </span>
          </span>
        </label>
      </div>

      <fieldset className="card space-y-4 p-4">
        <legend className="label px-1">Payment</legend>
        <div>
          <p className="text-sm font-semibold">Ways customers can pay</p>
          <p className="text-xs text-[var(--muted)]">
            They pick one when ordering. Nothing is charged online — this tells you what to expect.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((method) => (
              <label
                key={method}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name={`pay_${method}`}
                  defaultChecked={settings.payments.includes(method)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                {paymentLabel(method)}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="upiId">Your UPI ID</label>
          <input
            id="upiId"
            name="upiId"
            defaultValue={settings.upiId}
            placeholder="shivambakery@okaxis"
            autoCapitalize="none"
            className="field"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Customers who choose UPI get a button that opens GPay, PhonePe or Paytm with your UPI ID
            and the amount filled in.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="upiQr">Your UPI QR code (optional)</label>
          {settings.upiQr && (
            <div className="mb-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.upiQr}
                alt="Your UPI QR code"
                className="h-24 w-24 rounded-lg border border-[var(--line)] bg-white object-contain p-1"
              />
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--danger)]">
                <input type="checkbox" name="removeUpiQr" className="h-4 w-4" />
                Remove this QR
              </label>
            </div>
          )}
          <input
            id="upiQr"
            name="upiQr"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="block text-sm"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Shown to UPI payers too — handy for anyone ordering from a computer.
          </p>
        </div>
      </fieldset>

      <button type="submit" className="btn-primary">Save ordering settings</button>
    </form>
  );
}
