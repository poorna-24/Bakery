// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { actions } = vi.hoisted(() => ({ actions: { deleteOldOrders: vi.fn() } }));
vi.mock("@/app/admin/actions", () => actions);

const { default: OrderCleanup } = await import("./OrderCleanup");

const COUNTS = { "3m": 120, "6m": 60, "1y": 1, "2y": 0 };

function open() {
  render(<OrderCleanup counts={COUNTS} />);
  fireEvent.click(screen.getByText("Clean up old orders"));
}

describe("OrderCleanup", () => {
  it("starts at one year and shows how many orders each age covers", () => {
    open();
    const select = screen.getByLabelText("Delete orders older than") as HTMLSelectElement;
    expect(select.value).toBe("1y");
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "3 months (120 orders)",
      "6 months (60 orders)",
      "1 year (1 order)",
      "2 years (0 orders)",
    ]);
    expect(screen.getByRole("button", { name: "Delete 1 order" })).toBeInTheDocument();
  });

  it("asks before deleting, and backs out on No", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Delete 1 order" }));
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(screen.getByRole("button", { name: "Delete 1 order" })).toBeInTheDocument();
    expect(actions.deleteOldOrders).not.toHaveBeenCalled();
  });

  it("deletes the chosen age once confirmed and reports how many went", async () => {
    actions.deleteOldOrders.mockResolvedValue(60);
    open();
    fireEvent.change(screen.getByLabelText("Delete orders older than"), { target: { value: "6m" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete 60 orders" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete 60 orders" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Deleted 60 orders older than 6 months.");
    const sent = actions.deleteOldOrders.mock.calls[0][0] as FormData;
    expect(sent.get("age")).toBe("6m");
  });

  it("shows the button as busy while deleting", async () => {
    let finish: (count: number) => void = () => {};
    actions.deleteOldOrders.mockReturnValue(new Promise<number>((resolve) => (finish = resolve)));
    open();
    fireEvent.click(screen.getByRole("button", { name: "Delete 1 order" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete 1 order" }));

    expect(await screen.findByRole("button", { name: "Deleting…" })).toBeDisabled();
    finish(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Deleted 1 order older than 1 year.");
  });

  it("says there is nothing to delete when no order is that old", () => {
    open();
    fireEvent.change(screen.getByLabelText("Delete orders older than"), { target: { value: "2y" } });
    expect(screen.getByText("Nothing older than 2 years.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
  });
});
