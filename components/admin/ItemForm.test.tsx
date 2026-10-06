// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ItemFormValues } from "./ItemForm";

/**
 * The one screen where the owner does real work. Two things here are easy to
 * get wrong and expensive when they are: the photo — which can arrive as a file
 * or as a pasted link, and can be removed — and the list of sizes, which the
 * owner builds a row at a time.
 */

const { actions } = vi.hoisted(() => ({
  actions: { createItem: vi.fn(), updateItem: vi.fn() },
}));
vi.mock("@/app/admin/actions", () => actions);

const { default: ItemForm } = await import("./ItemForm");

const categories = [
  { id: "c1", name: "Cakes" },
  { id: "c2", name: "Breads" },
];

const blank: ItemFormValues = {
  categoryId: "c1",
  name: "",
  description: "",
  price: 0,
  unit: "per piece",
  imageUrl: null,
  isVeg: true,
  isEggless: false,
  isBestseller: false,
  isAvailable: true,
  variants: [],
};

const existing: ItemFormValues = {
  ...blank,
  id: "i1",
  name: "Choco Truffle",
  description: "Rich Belgian chocolate.",
  price: 650,
  unit: "per kg",
  imageUrl: "https://res.cloudinary.com/c/image/upload/v1/bakery/old.jpg",
  isBestseller: true,
  variants: [{ label: "500 g", price: 350 }],
};

function renderForm(values: ItemFormValues = blank, error?: string) {
  return render(<ItemForm values={values} categories={categories} error={error} />);
}

/** The form the owner is filling in, for asserting on what it would send. */
function theForm(): HTMLFormElement {
  return document.querySelector("form")!;
}

function fieldNamed(name: string): HTMLElement {
  return theForm().querySelector(`[name="${name}"]`)!;
}

async function submit(user: ReturnType<typeof userEvent.setup>, label: RegExp) {
  await user.click(screen.getByRole("button", { name: label }));
}

beforeEach(() => {
  // The preview needs a stable address to assert on.
  URL.createObjectURL = vi.fn(() => "blob:chosen-file");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("which action it submits to", () => {
  it("creates when there is no item yet", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/item name/i), "Rusk");
    await user.type(screen.getByLabelText(/price/i), "40");
    await submit(user, /add item/i);

    await waitFor(() => expect(actions.createItem).toHaveBeenCalled());
    expect(actions.updateItem).not.toHaveBeenCalled();
  });

  it("updates when editing one, and carries its id", async () => {
    const user = userEvent.setup();
    renderForm(existing);

    await submit(user, /save changes/i);

    await waitFor(() => expect(actions.updateItem).toHaveBeenCalled());
    const sent = actions.updateItem.mock.calls[0][0] as FormData;
    expect(sent.get("id")).toBe("i1");
    expect(actions.createItem).not.toHaveBeenCalled();
  });
});

describe("what it shows when editing", () => {
  it("fills every field in from the item", () => {
    renderForm(existing);

    expect(screen.getByLabelText(/item name/i)).toHaveValue("Choco Truffle");
    expect(screen.getByLabelText(/description/i)).toHaveValue("Rich Belgian chocolate.");
    expect(screen.getByLabelText(/price/i)).toHaveValue(650);
    expect(screen.getByLabelText(/sold as/i)).toHaveValue("per kg");
    expect(screen.getByLabelText("Bestseller (★ badge)")).toBeChecked();
    expect(screen.getByLabelText("Eggless")).not.toBeChecked();
  });

  it("offers every category, with the item's own selected", () => {
    renderForm({ ...existing, categoryId: "c2" });

    const select = screen.getByLabelText(/category/i);
    expect(select).toHaveValue("c2");
    expect(within(select).getAllByRole("option")).toHaveLength(2);
  });

  it("leaves the price box empty rather than showing a zero to delete", () => {
    renderForm();
    expect(screen.getByLabelText(/price/i)).toHaveValue(null);
  });

  it("shows the failure from the last attempt when there was one", () => {
    renderForm(blank, "That address did not lead to a picture.");
    expect(screen.getByText("That address did not lead to a picture.")).toBeInTheDocument();
  });

  it("shows nothing in its place when there was no failure", () => {
    renderForm();
    expect(screen.queryByText(/did not lead/i)).not.toBeInTheDocument();
  });
});

describe("choosing a photo", () => {
  it("starts with a placeholder when the item has none", () => {
    renderForm();
    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
    expect(theForm().querySelector("img")).toBeNull();
  });

  it("shows the item's current photo when it has one", () => {
    renderForm(existing);
    expect(theForm().querySelector("img")).toHaveAttribute("src", existing.imageUrl);
  });

  it("previews a file the moment it is chosen", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.upload(
      fieldNamed("image"),
      new File(["x"], "cake.jpg", { type: "image/jpeg" }),
    );

    expect(theForm().querySelector("img")).toHaveAttribute("src", "blob:chosen-file");
  });

  it("offers the file input first", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "Upload a file" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Paste a link" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("switches to the link box when asked", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Paste a link" }));

    expect(screen.getByRole("button", { name: "Paste a link" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(fieldNamed("imageLink").closest("div")).not.toHaveClass("hidden");
  });

  // Flicking between the two to re-read the instructions must not throw away
  // what has already been typed.
  it("keeps a typed link when the owner flicks back to the file tab", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Paste a link" }));
    await user.type(fieldNamed("imageLink"), "https://example.com/cake.jpg");
    await user.click(screen.getByRole("button", { name: "Upload a file" }));
    await user.click(screen.getByRole("button", { name: "Paste a link" }));

    expect(fieldNamed("imageLink")).toHaveValue("https://example.com/cake.jpg");
  });

  // A typo shows up immediately as a picture that never appears.
  it("previews a pasted link as it is typed", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Paste a link" }));
    await user.type(fieldNamed("imageLink"), "https://example.com/cake.jpg");

    expect(theForm().querySelector("img")).toHaveAttribute(
      "src",
      "https://example.com/cake.jpg",
    );
  });

  it("falls back to the existing photo when the link is cleared again", async () => {
    const user = userEvent.setup();
    renderForm(existing);

    await user.click(screen.getByRole("button", { name: "Paste a link" }));
    await user.type(fieldNamed("imageLink"), "https://example.com/cake.jpg");
    await user.clear(fieldNamed("imageLink"));

    expect(theForm().querySelector("img")).toHaveAttribute("src", existing.imageUrl);
  });

  // Only one source can win, so the form has to show which one that is.
  it("clears a typed link when a file is chosen instead", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Paste a link" }));
    await user.type(fieldNamed("imageLink"), "https://example.com/cake.jpg");
    await user.upload(fieldNamed("image"), new File(["x"], "cake.jpg", { type: "image/jpeg" }));

    expect(fieldNamed("imageLink")).toHaveValue("");
    expect(theForm().querySelector("img")).toHaveAttribute("src", "blob:chosen-file");
  });

  // The server takes a file over a link, so a chosen file left behind would
  // win the save while the preview showed the link.
  it("drops a chosen file when a link is pasted instead", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.upload(fieldNamed("image"), new File(["x"], "cake.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Paste a link" }));
    await user.type(fieldNamed("imageLink"), "https://example.com/tart.jpg");

    expect((fieldNamed("image") as HTMLInputElement).files).toHaveLength(0);
    expect(theForm().querySelector("img")).toHaveAttribute("src", "https://example.com/tart.jpg");
  });

  describe("dragging a photo onto the box", () => {
    const realDataTransfer = globalThis.DataTransfer;

    // jsdom has no DataTransfer, and its input.files only takes a real
    // FileList. Stand in for both and record what the drop hands the input.
    function stubDrop() {
      globalThis.DataTransfer = class {
        added: File[] = [];
        items = { add: (file: File) => this.added.push(file) };
        get files() {
          return this.added;
        }
      } as unknown as typeof DataTransfer;

      const input = fieldNamed("image");
      const handed: { files?: File[] } = {};
      Object.defineProperty(input, "files", {
        configurable: true,
        set: (files: File[]) => (handed.files = files),
        get: () => handed.files ?? [],
      });
      return { dropZone: input.closest("label")!, handed };
    }

    afterEach(() => {
      globalThis.DataTransfer = realDataTransfer;
    });

    it("highlights while a photo is held over it, and stops when it leaves", () => {
      renderForm();
      const { dropZone } = stubDrop();

      fireEvent.dragOver(dropZone);
      expect(dropZone).toHaveClass("bg-amber-50");

      fireEvent.dragLeave(dropZone);
      expect(dropZone).not.toHaveClass("bg-amber-50");
    });

    it("puts a dropped photo into the form and previews it", () => {
      renderForm();
      const { dropZone, handed } = stubDrop();
      const file = new File(["x"], "dropped.jpg", { type: "image/jpeg" });

      fireEvent.dragOver(dropZone);
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      expect(handed.files, "the input is what the form submits").toEqual([file]);
      expect(screen.getByText("dropped.jpg")).toBeInTheDocument();
      expect(theForm().querySelector("img")).toHaveAttribute("src", "blob:chosen-file");
      expect(dropZone).not.toHaveClass("bg-amber-50");
    });

    it("ignores a dropped file that is not a picture", () => {
      renderForm(existing);
      const { dropZone, handed } = stubDrop();

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [new File(["x"], "menu.pdf", { type: "application/pdf" })] },
      });

      expect(handed.files).toBeUndefined();
      expect(theForm().querySelector("img")).toHaveAttribute("src", existing.imageUrl);
    });

    it("ignores a drop with nothing in it", () => {
      renderForm(existing);
      const { dropZone, handed } = stubDrop();

      fireEvent.drop(dropZone, { dataTransfer: { files: [] } });

      expect(handed.files).toBeUndefined();
    });
  });

  it("names the chosen file so the owner knows it was picked", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.upload(fieldNamed("image"), new File(["x"], "cake.jpg", { type: "image/jpeg" }));

    expect(screen.getByText("cake.jpg")).toBeInTheDocument();
  });

  it("says whether the preview is the saved photo or a new one", async () => {
    const user = userEvent.setup();
    renderForm(existing);
    expect(screen.getByText("Current photo")).toBeInTheDocument();

    await user.upload(fieldNamed("image"), new File(["x"], "cake.jpg", { type: "image/jpeg" }));
    expect(screen.getByText(/new photo · not saved yet/i)).toBeInTheDocument();
  });

  // Cancelling the dialog fires a change with nothing selected. userEvent
  // short-circuits an empty upload without firing anything, so this has to
  // dispatch the event the browser would actually send.
  it("does nothing when the file dialog is cancelled", () => {
    renderForm(existing);

    fireEvent.change(fieldNamed("image"), { target: { files: [] } });

    expect(theForm().querySelector("img")).toHaveAttribute("src", existing.imageUrl);
  });
});

describe("removing the current photo", () => {
  it("is not offered for an item that has none", () => {
    renderForm();
    expect(screen.queryByRole("button", { name: /remove current photo/i })).not.toBeInTheDocument();
  });

  it("clears the preview and says what will happen on save", async () => {
    const user = userEvent.setup();
    renderForm(existing);

    await user.click(screen.getByRole("button", { name: /remove current photo/i }));

    expect(theForm().querySelector("img")).toBeNull();
    expect(screen.getByText(/photo will be removed when you save/i)).toBeInTheDocument();
  });

  it("sends the removal along with the rest of the form", async () => {
    const user = userEvent.setup();
    renderForm(existing);

    await user.click(screen.getByRole("button", { name: /remove current photo/i }));
    await submit(user, /save changes/i);

    await waitFor(() => expect(actions.updateItem).toHaveBeenCalled());
    expect((actions.updateItem.mock.calls[0][0] as FormData).get("removeImage")).toBe("on");
  });

  it("puts the photo back on Undo", async () => {
    const user = userEvent.setup();
    renderForm(existing);

    await user.click(screen.getByRole("button", { name: /remove current photo/i }));
    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(theForm().querySelector("img")).toHaveAttribute("src", existing.imageUrl);
    expect(screen.queryByText(/photo will be removed/i)).not.toBeInTheDocument();
  });

  // Choosing a replacement is a clearer statement of intent than the pending
  // removal, so the removal should give way to it.
  it("is called off when a new photo is chosen instead", async () => {
    const user = userEvent.setup();
    renderForm(existing);

    await user.click(screen.getByRole("button", { name: /remove current photo/i }));
    await user.upload(fieldNamed("image"), new File(["x"], "new.jpg", { type: "image/jpeg" }));

    expect(theForm().querySelector("img")).toHaveAttribute("src", "blob:chosen-file");
    expect(screen.queryByText(/photo will be removed/i)).not.toBeInTheDocument();
  });

  it("is called off when a link is pasted instead", async () => {
    const user = userEvent.setup();
    renderForm(existing);

    await user.click(screen.getByRole("button", { name: /remove current photo/i }));
    await user.click(screen.getByRole("button", { name: "Paste a link" }));
    await user.type(fieldNamed("imageLink"), "https://example.com/new.jpg");

    expect(screen.queryByText(/photo will be removed/i)).not.toBeInTheDocument();
  });
});

describe("sizes", () => {
  it("shows none until one is added", () => {
    renderForm();
    expect(screen.queryByPlaceholderText("500 g")).not.toBeInTheDocument();
  });

  it("lists the sizes the item already has", () => {
    renderForm(existing);

    expect(screen.getByPlaceholderText("500 g")).toHaveValue("500 g");
    expect(screen.getByPlaceholderText("450")).toHaveValue(350);
  });

  it("adds an empty row on request", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /add size/i }));

    expect(screen.getByPlaceholderText("500 g")).toHaveValue("");
  });

  it("sends each row as a label and a price", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/item name/i), "Cake");
    await user.type(screen.getByLabelText(/price/i), "650");
    await user.click(screen.getByRole("button", { name: /add size/i }));
    await user.type(screen.getByPlaceholderText("500 g"), "500 g");
    await user.type(screen.getByPlaceholderText("450"), "350");
    await submit(user, /add item/i);

    await waitFor(() => expect(actions.createItem).toHaveBeenCalled());
    const sent = actions.createItem.mock.calls[0][0] as FormData;
    expect(sent.getAll("variantLabel")).toEqual(["500 g"]);
    expect(sent.getAll("variantPrice")).toEqual(["350"]);
  });

  it("keeps several rows apart as they are typed", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /add size/i }));
    await user.click(screen.getByRole("button", { name: /add size/i }));

    const labels = screen.getAllByPlaceholderText("500 g");
    await user.type(labels[0], "500 g");
    await user.type(labels[1], "1 kg");

    expect(labels[0]).toHaveValue("500 g");
    expect(labels[1]).toHaveValue("1 kg");
  });

  it("removes the row that was asked to go, not the last one", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /add size/i }));
    await user.click(screen.getByRole("button", { name: /add size/i }));

    const labels = screen.getAllByPlaceholderText("500 g");
    await user.type(labels[0], "500 g");
    await user.type(labels[1], "1 kg");
    await user.click(screen.getAllByRole("button", { name: "Remove size" })[0]);

    const left = screen.getAllByPlaceholderText("500 g");
    expect(left).toHaveLength(1);
    expect(left[0]).toHaveValue("1 kg");
  });

  it("hides the list again once every row is removed", async () => {
    const user = userEvent.setup();
    renderForm(existing);

    await user.click(screen.getByRole("button", { name: "Remove size" }));

    expect(screen.queryByPlaceholderText("500 g")).not.toBeInTheDocument();
  });
});

describe("the buttons at the foot", () => {
  it("says Add item for a new one and Save changes when editing", () => {
    const { unmount } = renderForm();
    expect(screen.getByRole("button", { name: "Add item" })).toBeEnabled();
    unmount();

    renderForm(existing);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("offers a way back to the category without saving", () => {
    renderForm({ ...blank, categoryId: "c2" });
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/admin/categories/c2",
    );
  });
});
