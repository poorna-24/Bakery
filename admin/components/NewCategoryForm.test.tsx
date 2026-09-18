// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { actions } = vi.hoisted(() => ({ actions: { createCategory: vi.fn() } }));
vi.mock("@/app/actions", () => actions);

const { default: NewCategoryForm } = await import("./NewCategoryForm");

/**
 * The form stays folded away until it is wanted: the dashboard is a list of
 * categories, and an always-open form on top of it pushes that list down the
 * page for the sake of something used once a month.
 */

afterEach(() => {
  vi.clearAllMocks();
});

describe("NewCategoryForm", () => {
  it("shows only a button to begin with", () => {
    render(<NewCategoryForm />);

    expect(screen.getByRole("button", { name: /new category/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/category name/i)).not.toBeInTheDocument();
  });

  it("opens the form when the button is pressed", async () => {
    const user = userEvent.setup();
    render(<NewCategoryForm />);

    await user.click(screen.getByRole("button", { name: /new category/i }));

    expect(screen.getByPlaceholderText(/chocolate delights/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add category" })).toBeInTheDocument();
  });

  it("folds away again on Cancel", async () => {
    const user = userEvent.setup();
    render(<NewCategoryForm />);

    await user.click(screen.getByRole("button", { name: /new category/i }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByPlaceholderText(/chocolate delights/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new category/i })).toBeInTheDocument();
  });

  it("sends the name and description to be saved", async () => {
    const user = userEvent.setup();
    render(<NewCategoryForm />);

    await user.click(screen.getByRole("button", { name: /new category/i }));
    await user.type(screen.getByPlaceholderText(/chocolate delights/i), "Cakes");
    await user.type(screen.getByPlaceholderText(/one line shown/i), "Fresh every morning");
    await user.click(screen.getByRole("button", { name: "Add category" }));

    await waitFor(() => expect(actions.createCategory).toHaveBeenCalled());

    const sent = actions.createCategory.mock.calls[0][0] as FormData;
    expect(sent.get("name")).toBe("Cakes");
    expect(sent.get("description")).toBe("Fresh every morning");
  });

  // Adding several categories in a row is the normal way this gets used, and
  // a form still holding the last name invites saving it twice.
  it("empties itself afterwards so the next one can be typed straight in", async () => {
    const user = userEvent.setup();
    render(<NewCategoryForm />);

    await user.click(screen.getByRole("button", { name: /new category/i }));
    const name = screen.getByPlaceholderText(/chocolate delights/i);
    await user.type(name, "Cakes");
    await user.click(screen.getByRole("button", { name: "Add category" }));

    await waitFor(() => expect(name).toHaveValue(""));
  });
});
