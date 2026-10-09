// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEFAULT_ORDERING } from "@/lib/ordering";

/**
 * The WhatsApp ordering switches on the dashboard. Saving is the server
 * action's job (tested there); this pins what the form shows and sends.
 */

const { actions } = vi.hoisted(() => ({ actions: { saveOrdering: vi.fn() } }));
vi.mock("@/app/admin/actions", () => actions);

const { default: OrderingForm } = await import("./OrderingForm");

describe("OrderingForm", () => {
  it("shows the saved switches", () => {
    render(
      <OrderingForm
        settings={{ ...DEFAULT_ORDERING, enabled: true, tables: 12, minOrder: 150, whatsapp: "9876543210" }}
        fallbackNumber="+91 76660 93143"
      />,
    );

    expect(screen.getByRole("checkbox", { name: /take orders on whatsapp/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /i'm at a table/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /i'm at the counter/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /pick up later/i })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /delivery/i })).not.toBeChecked();
    expect(screen.getByRole("spinbutton", { name: /number of tables/i })).toHaveValue(12);
    expect(screen.getByLabelText(/send orders to/i)).toHaveValue("9876543210");
    expect(screen.getByLabelText(/minimum order/i)).toHaveValue(150);
    expect(screen.getByRole("checkbox", { name: /only accept orders while/i })).toBeChecked();
  });

  it("explains that an empty number falls back to the shop's own", () => {
    render(<OrderingForm settings={DEFAULT_ORDERING} fallbackNumber="+91 76660 93143" />);

    expect(screen.getByRole("checkbox", { name: /take orders on whatsapp/i })).not.toBeChecked();
    expect(screen.getByText(/leave empty to use the shop's number, \+91 76660 93143/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/send orders to/i)).toHaveAttribute("placeholder", "+91 76660 93143");
  });

  it("asks for a number when the shop has none to fall back on", () => {
    render(
      <OrderingForm settings={{ ...DEFAULT_ORDERING, tables: 0, minOrder: 0 }} fallbackNumber="" />,
    );

    expect(screen.getByText(/include the country code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/send orders to/i)).toHaveAttribute("placeholder", "+91 98765 43210");
    expect(screen.getByRole("spinbutton", { name: /number of tables/i })).toHaveValue(null);
    expect(screen.getByLabelText(/minimum order/i)).toHaveValue(null);
  });

  it("submits to the ordering action", () => {
    const { container } = render(<OrderingForm settings={DEFAULT_ORDERING} fallbackNumber="" />);
    expect(container.querySelector("form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save ordering settings/i })).toHaveAttribute("type", "submit");
  });
});

describe("OrderingForm — payment", () => {
  it("shows the chosen ways to pay, the UPI ID and the saved QR", () => {
    render(
      <OrderingForm
        settings={{ ...DEFAULT_ORDERING, payments: ["cash", "upi"], upiId: "shivam@okaxis", upiQr: "/uploads/qr.png" }}
        fallbackNumber=""
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Cash" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /upi \(gpay/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Card" })).not.toBeChecked();
    expect(screen.getByLabelText("Your UPI ID")).toHaveValue("shivam@okaxis");
    expect(screen.getByRole("img", { name: "Your UPI QR code" })).toHaveAttribute("src", "/uploads/qr.png");
    expect(screen.getByRole("checkbox", { name: /remove this qr/i })).not.toBeChecked();
    expect(screen.getByLabelText(/your upi qr code \(optional\)/i)).toHaveAttribute("type", "file");
  });

  it("offers only the upload when no QR is saved yet", () => {
    render(<OrderingForm settings={DEFAULT_ORDERING} fallbackNumber="" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /remove this qr/i })).not.toBeInTheDocument();
  });
});
