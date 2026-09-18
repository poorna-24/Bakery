// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Opening hours, which drive the Open / Closed badge on the customer menu.
 */

const { actions } = vi.hoisted(() => ({ actions: { saveHours: vi.fn() } }));
vi.mock("@/app/actions", () => actions);

const { default: HoursForm } = await import("./HoursForm");

function renderForm(
  props: Partial<{ open: string; close: string; closedDays: number[]; isSet: boolean }> = {},
) {
  return render(
    <HoursForm
      open={props.open ?? "07:00"}
      close={props.close ?? "21:00"}
      closedDays={props.closedDays ?? []}
      isSet={props.isSet ?? true}
    />,
  );
}

function sent(): FormData {
  return actions.saveHours.mock.calls[0][0] as FormData;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("the times", () => {
  it("starts from whatever is already saved", () => {
    renderForm();

    expect(screen.getByLabelText(/opens at/i)).toHaveValue("07:00");
    expect(screen.getByLabelText(/closes at/i)).toHaveValue("21:00");
  });

  it("sends what the owner set", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByLabelText(/opens at/i));
    await user.type(screen.getByLabelText(/opens at/i), "08:30");
    await user.click(screen.getByRole("button", { name: "Save hours" }));

    await waitFor(() => expect(actions.saveHours).toHaveBeenCalled());
    expect(sent().get("open")).toBe("08:30");
    expect(sent().get("close")).toBe("21:00");
  });
});

describe("the weekly off", () => {
  it("offers every day of the week", () => {
    renderForm();

    for (const day of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      expect(screen.getByLabelText(day)).toBeInTheDocument();
    }
  });

  it("ticks the days already saved", () => {
    renderForm({ closedDays: [0, 3] });

    expect(screen.getByLabelText("Sun")).toBeChecked();
    expect(screen.getByLabelText("Wed")).toBeChecked();
    expect(screen.getByLabelText("Mon")).not.toBeChecked();
  });

  it("sends each ticked day", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText("Sun"));
    await user.click(screen.getByLabelText("Wed"));
    await user.click(screen.getByRole("button", { name: "Save hours" }));

    await waitFor(() => expect(actions.saveHours).toHaveBeenCalled());
    expect(sent().getAll("closedDays")).toEqual(["0", "3"]);
  });

  it("sends none when the shop opens every day", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Save hours" }));

    await waitFor(() => expect(actions.saveHours).toHaveBeenCalled());
    expect(sent().getAll("closedDays")).toEqual([]);
  });
});

describe("hiding the badge", () => {
  // Nothing is deleted from the menu — the badge simply stops being shown.
  it("is offered once hours have been set", async () => {
    const user = userEvent.setup();
    renderForm({ isSet: true });

    await user.click(screen.getByRole("button", { name: /hide the badge/i }));

    await waitFor(() => expect(actions.saveHours).toHaveBeenCalled());
    expect(sent().get("clear")).toBe("1");
  });

  it("is not offered when there are no hours to hide", () => {
    renderForm({ isSet: false });
    expect(screen.queryByRole("button", { name: /hide the badge/i })).not.toBeInTheDocument();
  });

  it("does not send the clear flag on an ordinary save", async () => {
    const user = userEvent.setup();
    renderForm({ isSet: true });

    await user.click(screen.getByRole("button", { name: "Save hours" }));

    await waitFor(() => expect(actions.saveHours).toHaveBeenCalled());
    expect(sent().get("clear")).toBeNull();
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
