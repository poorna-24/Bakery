// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * One row of the dashboard list. It does three jobs in the same space —
 * viewing, renaming and deleting — so the interesting part is that the right
 * one is showing, and that deleting a category full of items asks what should
 * happen to them rather than quietly taking them with it.
 */

const { actions } = vi.hoisted(() => ({
  actions: {
    deleteCategory: vi.fn(),
    moveCategory: vi.fn(),
    toggleCategoryVisible: vi.fn(),
    updateCategory: vi.fn(),
  },
}));
vi.mock("@/app/actions", () => actions);
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { default: CategoryRow } = await import("./CategoryRow");

const category = {
  id: "c1",
  name: "Cakes",
  description: "Fresh every morning",
  isVisible: true,
  itemCount: 3,
};

const others = [{ id: "c2", name: "Breads" }];

function renderRow(
  overrides: Partial<typeof category> = {},
  props: { isFirst?: boolean; isLast?: boolean; otherCategories?: typeof others } = {},
) {
  return render(
    <CategoryRow
      category={{ ...category, ...overrides }}
      isFirst={props.isFirst ?? false}
      isLast={props.isLast ?? false}
      otherCategories={props.otherCategories ?? others}
    />,
  );
}

/** The FormData the given action was last called with. */
function sentTo(action: { mock: { calls: unknown[][] } }): FormData {
  return action.mock.calls[0][0] as FormData;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("the row as it normally looks", () => {
  it("names the category and links to it", () => {
    renderRow();

    expect(screen.getByRole("link", { name: "Cakes" })).toHaveAttribute(
      "href",
      "/categories/c1",
    );
  });

  it("counts the items and shows the description", () => {
    renderRow();
    expect(screen.getByText("3 items · Fresh every morning")).toBeInTheDocument();
  });

  it("says item rather than items when there is one", () => {
    renderRow({ itemCount: 1, description: "" });
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("says items for an empty category", () => {
    renderRow({ itemCount: 0, description: "" });
    expect(screen.getByText("0 items")).toBeInTheDocument();
  });

  // A hidden category is still on this list, so it has to be obvious which.
  it("marks a hidden category", () => {
    renderRow({ isVisible: false });
    expect(screen.getByText("Hidden")).toBeInTheDocument();
  });

  it("does not mark a visible one", () => {
    renderRow();
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});

describe("showing and hiding", () => {
  it("offers to hide a visible category", async () => {
    const user = userEvent.setup();
    renderRow();

    const button = screen.getByRole("button", { name: "Hide" });
    expect(button).toHaveAttribute("title", "Hide from customers");

    await user.click(button);

    await waitFor(() => expect(actions.toggleCategoryVisible).toHaveBeenCalled());
    expect(sentTo(actions.toggleCategoryVisible).get("id")).toBe("c1");
  });

  it("offers to show a hidden one", () => {
    renderRow({ isVisible: false });

    expect(screen.getByRole("button", { name: "Show" })).toHaveAttribute(
      "title",
      "Show to customers",
    );
  });
});

describe("reordering", () => {
  it("sends the direction asked for", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Move down" }));

    await waitFor(() => expect(actions.moveCategory).toHaveBeenCalled());
    expect(sentTo(actions.moveCategory).get("direction")).toBe("down");
    expect(sentTo(actions.moveCategory).get("id")).toBe("c1");
  });

  // Nothing above the first or below the last, so the arrows say so.
  it("cannot move the first one up", () => {
    renderRow({}, { isFirst: true });

    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down" })).toBeEnabled();
  });

  it("cannot move the last one down", () => {
    renderRow({}, { isLast: true });
    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();
  });
});

describe("renaming", () => {
  it("swaps the row for a form filled in with what is there", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Rename" }));

    expect(screen.getByLabelText(/category name/i)).toHaveValue("Cakes");
    expect(screen.getByLabelText(/description/i)).toHaveValue("Fresh every morning");
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("saves the new name", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.clear(screen.getByLabelText(/category name/i));
    await user.type(screen.getByLabelText(/category name/i), "Cakes & Bakes");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(actions.updateCategory).toHaveBeenCalled());
    expect(sentTo(actions.updateCategory).get("name")).toBe("Cakes & Bakes");
    expect(sentTo(actions.updateCategory).get("id")).toBe("c1");
  });

  it("goes back to the row on Cancel without saving", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("link", { name: "Cakes" })).toBeInTheDocument();
    expect(actions.updateCategory).not.toHaveBeenCalled();
  });
});

describe("deleting", () => {
  it("asks first, naming the category", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText(/delete “Cakes”\?/i)).toBeInTheDocument();
    expect(actions.deleteCategory).not.toHaveBeenCalled();
  });

  it("backs out on Cancel", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("link", { name: "Cakes" })).toBeInTheDocument();
  });

  it("just confirms when the category is empty", async () => {
    const user = userEvent.setup();
    renderRow({ itemCount: 0 });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByRole("button", { name: /yes, delete it/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/move items to/i)).not.toBeInTheDocument();
  });

  describe("when it still holds items", () => {
    // Deleting a category takes its items with it, which is not obvious from
    // the word "delete" — so the choice is put in front of the owner.
    it("says how many, and offers to move them instead", async () => {
      const user = userEvent.setup();
      renderRow();

      await user.click(screen.getByRole("button", { name: "Delete" }));

      expect(screen.getByText(/it holds 3 items/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/move items to/i)).toBeInTheDocument();
    });

    it("counts one item in the singular", async () => {
      const user = userEvent.setup();
      renderRow({ itemCount: 1 });

      await user.click(screen.getByRole("button", { name: "Delete" }));

      expect(screen.getByText(/it holds 1 item\./i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /delete category and its 1 item$/i }),
      ).toBeInTheDocument();
    });

    it("sends the category the items should move to", async () => {
      const user = userEvent.setup();
      renderRow();

      await user.click(screen.getByRole("button", { name: "Delete" }));
      await user.click(screen.getByRole("button", { name: /move & delete category/i }));

      await waitFor(() => expect(actions.deleteCategory).toHaveBeenCalled());
      expect(sentTo(actions.deleteCategory).get("moveTo")).toBe("c2");
    });

    it("sends no destination when the items are to go too", async () => {
      const user = userEvent.setup();
      renderRow();

      await user.click(screen.getByRole("button", { name: "Delete" }));
      await user.click(screen.getByRole("button", { name: /delete category and its 3 items/i }));

      await waitFor(() => expect(actions.deleteCategory).toHaveBeenCalled());
      expect(sentTo(actions.deleteCategory).get("moveTo")).toBeNull();
    });

    // With nowhere to move them to, offering the choice would be a dead end.
    it("does not offer to move them when this is the only category", async () => {
      const user = userEvent.setup();
      renderRow({}, { otherCategories: [] });

      await user.click(screen.getByRole("button", { name: "Delete" }));

      expect(screen.queryByLabelText(/move items to/i)).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /delete category and its 3 items/i }),
      ).toBeInTheDocument();
    });
  });
});
