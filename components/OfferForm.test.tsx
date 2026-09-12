// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Offer } from "@/lib/offer";

/**
 * The festival strip. Its whole job is to be seen, so the form shows the owner
 * exactly what the customer will get — in the chosen colour — before saving.
 */

const { actions } = vi.hoisted(() => ({
  actions: { saveOffer: vi.fn(), removeOffer: vi.fn() },
}));
vi.mock("@/app/actions", () => actions);

const { default: OfferForm } = await import("./OfferForm");

const draft: Offer = {
  text: "Ganesh Chaturthi — 15% off",
  note: "Till Sunday",
  tone: "gold",
  isVisible: true,
};

const empty: Offer = { text: "", note: "", tone: "festive", isVisible: true };

function renderForm(values: Offer = draft, exists = true) {
  return render(<OfferForm draft={values} exists={exists} />);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("the preview", () => {
  it("shows the offer as the customer will see it", () => {
    renderForm();

    expect(screen.getByText("Ganesh Chaturthi — 15% off")).toBeInTheDocument();
    expect(screen.getByText("Till Sunday")).toBeInTheDocument();
  });

  it("invites the owner to start typing when there is nothing yet", () => {
    renderForm(empty, false);

    expect(screen.getByText(/nothing yet — type below/i)).toBeInTheDocument();
  });

  it("fills in as the text is typed", async () => {
    const user = userEvent.setup();
    renderForm(empty, false);

    await user.type(screen.getByLabelText(/offer text/i), "Diwali sale");

    expect(screen.getByText("Diwali sale")).toBeInTheDocument();
    expect(screen.queryByText(/nothing yet/i)).not.toBeInTheDocument();
  });

  it("leaves the second line out when there is none", () => {
    renderForm({ ...draft, note: "" });
    expect(screen.queryByText("Till Sunday")).not.toBeInTheDocument();
  });

  it("fills the second line in as it is typed", async () => {
    const user = userEvent.setup();
    renderForm({ ...draft, note: "" });

    await user.type(screen.getByLabelText(/second line/i), "Till 5 November");

    expect(screen.getByText("Till 5 November")).toBeInTheDocument();
  });

  it("paints it in the chosen colour, and repaints when that changes", async () => {
    const user = userEvent.setup();
    renderForm();

    // The colour buttons carry these classes on their swatches too, so look
    // only at the strip wrapped around the offer text itself.
    const strip = () => screen.getByText("Ganesh Chaturthi — 15% off").parentElement!;

    expect(strip()).toHaveClass("offer-gold");

    await user.click(screen.getByRole("button", { name: /berry/i }));

    expect(strip()).toHaveClass("offer-berry");
    expect(strip()).not.toHaveClass("offer-gold");
  });

  // Writing an offer and not seeing it on the menu is a confusing half-hour.
  it("warns that a written offer is not actually showing", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByText(/hidden — customers will not see/i)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/show on the menu/i));

    expect(screen.getByText(/hidden — customers will not see/i)).toBeInTheDocument();
  });

  it("does not warn about an empty offer, which has nothing to hide", () => {
    renderForm({ ...empty, isVisible: false }, false);
    expect(screen.queryByText(/hidden — customers will not see/i)).not.toBeInTheDocument();
  });
});

describe("the length counters", () => {
  it("counts what has been typed against the limit", async () => {
    const user = userEvent.setup();
    renderForm(empty, false);

    expect(screen.getByText(/^0\/90/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/offer text/i), "Diwali");

    expect(screen.getByText(/^6\/90/)).toBeInTheDocument();
  });

  it("counts the second line separately", () => {
    renderForm();
    expect(screen.getByText(/^11\/120/)).toBeInTheDocument();
  });

  // The strip is one line on a phone; the box stops rather than letting the
  // owner write something that will be cut off on saving.
  it("will not accept more than the strip can show", () => {
    renderForm();

    expect(screen.getByLabelText(/offer text/i)).toHaveAttribute("maxLength", "90");
    expect(screen.getByLabelText(/second line/i)).toHaveAttribute("maxLength", "120");
  });
});

describe("choosing a colour", () => {
  it("marks the current one as pressed", () => {
    renderForm();

    expect(screen.getByRole("button", { name: /gold/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /berry/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("sends the chosen colour with the rest of the form", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /fresh/i }));
    await user.click(screen.getByRole("button", { name: "Save offer" }));

    await waitFor(() => expect(actions.saveOffer).toHaveBeenCalled());
    expect((actions.saveOffer.mock.calls[0][0] as FormData).get("tone")).toBe("fresh");
  });
});

describe("saving", () => {
  it("sends the text, note and whether it is showing", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Save offer" }));

    await waitFor(() => expect(actions.saveOffer).toHaveBeenCalled());
    const sent = actions.saveOffer.mock.calls[0][0] as FormData;
    expect(sent.get("text")).toBe("Ganesh Chaturthi — 15% off");
    expect(sent.get("note")).toBe("Till Sunday");
    expect(sent.get("isVisible")).toBe("on");
  });

  it("leaves the visibility flag out when the strip is hidden", async () => {
    const user = userEvent.setup();
    renderForm({ ...draft, isVisible: false });

    await user.click(screen.getByRole("button", { name: "Save offer" }));

    await waitFor(() => expect(actions.saveOffer).toHaveBeenCalled());
    expect((actions.saveOffer.mock.calls[0][0] as FormData).get("isVisible")).toBeNull();
  });
});

describe("removing the offer", () => {
  it("is not offered when there is nothing saved yet", () => {
    renderForm(empty, false);
    expect(screen.queryByRole("button", { name: /remove offer/i })).not.toBeInTheDocument();
  });

  // Removing throws away text that tends to be reused next festival, so it
  // asks first rather than acting on one click.
  it("asks before throwing the text away", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /remove offer/i }));

    expect(screen.getByText(/delete the text as well\?/i)).toBeInTheDocument();
    expect(actions.removeOffer).not.toHaveBeenCalled();
  });

  it("removes it once confirmed", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /remove offer/i }));
    await user.click(screen.getByRole("button", { name: /yes, remove it/i }));

    await waitFor(() => expect(actions.removeOffer).toHaveBeenCalled());
    expect(actions.saveOffer).not.toHaveBeenCalled();
  });

  it("backs out on Cancel", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /remove offer/i }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText(/delete the text as well\?/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove offer/i })).toBeInTheDocument();
    expect(actions.removeOffer).not.toHaveBeenCalled();
  });
});

describe("the preview link", () => {
  it("offers a look at the real menu", () => {
    renderForm();
    expect(screen.getByRole("link", { name: /preview on a phone/i })).toHaveAttribute(
      "href",
      "/preview",
    );
  });
});
