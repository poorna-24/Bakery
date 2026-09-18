// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BACKGROUNDS } from "@/lib/backgrounds";

/**
 * A gallery rather than a switch: the owner has to say *which* background, and
 * each swatch is painted by the very class the customer page will use — so
 * what is shown here is the real thing, not an approximation of it.
 */

const { actions } = vi.hoisted(() => ({
  actions: { saveAppearance: vi.fn(), removeBackgroundImage: vi.fn() },
}));
vi.mock("@/app/actions", () => actions);

const { default: BackgroundPicker } = await import("./BackgroundPicker");

const photo = "https://res.cloudinary.com/c/image/upload/v1/bakery/shop.jpg";

function swatch(label: string | RegExp) {
  return screen.getByRole("button", { name: label });
}

/** What the hidden field would send — the choice the form actually carries. */
function chosen(): string {
  return document.querySelector<HTMLInputElement>('[name="backgroundId"]')!.value;
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:chosen-photo");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("the gallery", () => {
  it("offers every background there is", () => {
    render(<BackgroundPicker selected="plain" uploadedImageUrl={null} />);

    for (const option of BACKGROUNDS) {
      expect(screen.getByText(option.label)).toBeInTheDocument();
    }
  });

  it("marks the one already in use", () => {
    render(<BackgroundPicker selected="linen" uploadedImageUrl={null} />);

    expect(swatch(/linen weave/i)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Selected")).toBeInTheDocument();
  });

  it("moves the mark when another is picked", async () => {
    const user = userEvent.setup();
    render(<BackgroundPicker selected="plain" uploadedImageUrl={null} />);

    await user.click(swatch(/piped icing/i));

    expect(swatch(/piped icing/i)).toHaveAttribute("aria-pressed", "true");
    expect(chosen()).toBe("scallops");
  });

  // The swatch is painted by the customer page's own class, so a mismatch
  // between what is previewed and what is served would show up here.
  it("paints each pattern with the class the menu will use", () => {
    const { container } = render(<BackgroundPicker selected="plain" uploadedImageUrl={null} />);

    const dots = BACKGROUNDS.find((option) => option.id === "dots")!;
    expect(container.querySelector(`.${CSS.escape(dots.className)}`)).toBeInTheDocument();
  });
});

describe("the photo swatch", () => {
  it("says there is no photo yet when none has been uploaded", () => {
    render(<BackgroundPicker selected="plain" uploadedImageUrl={null} />);
    expect(screen.getByText(/no photo yet/i)).toBeInTheDocument();
  });

  it("shows the uploaded photo when there is one", () => {
    const { container } = render(<BackgroundPicker selected="custom" uploadedImageUrl={photo} />);

    expect(container.querySelector("img")).toHaveAttribute("src", photo);
    expect(screen.queryByText(/no photo yet/i)).not.toBeInTheDocument();
  });

  it("previews a newly chosen file straight away", async () => {
    const user = userEvent.setup();
    const { container } = render(<BackgroundPicker selected="plain" uploadedImageUrl={null} />);

    await user.upload(
      document.querySelector<HTMLInputElement>('[name="backgroundImage"]')!,
      new File(["x"], "shop.jpg", { type: "image/jpeg" }),
    );

    expect(container.querySelector("img")).toHaveAttribute("src", "blob:chosen-photo");
  });

  // Uploading a photo and then having to remember to also select it is the
  // kind of step people miss, then think the feature is broken.
  it("selects the photo background automatically on upload", async () => {
    const user = userEvent.setup();
    render(<BackgroundPicker selected="plain" uploadedImageUrl={null} />);

    await user.upload(
      document.querySelector<HTMLInputElement>('[name="backgroundImage"]')!,
      new File(["x"], "shop.jpg", { type: "image/jpeg" }),
    );

    expect(chosen()).toBe("custom");
  });

  // Cancelling the dialog fires a change with nothing selected. userEvent
  // short-circuits an empty upload without firing anything, so this has to
  // dispatch the event the browser would actually send.
  it("does nothing when the file dialog is cancelled", () => {
    render(<BackgroundPicker selected="dots" uploadedImageUrl={null} />);

    fireEvent.change(document.querySelector<HTMLInputElement>('[name="backgroundImage"]')!, {
      target: { files: [] },
    });

    expect(chosen()).toBe("dots");
  });
});

describe("removing the uploaded photo", () => {
  it("is not offered when there is no photo", () => {
    render(<BackgroundPicker selected="plain" uploadedImageUrl={null} />);
    expect(screen.queryByRole("button", { name: /remove uploaded photo/i })).not.toBeInTheDocument();
  });

  it("goes to its own action rather than the save one", async () => {
    const user = userEvent.setup();
    render(<BackgroundPicker selected="custom" uploadedImageUrl={photo} />);

    await user.click(screen.getByRole("button", { name: /remove uploaded photo/i }));

    await waitFor(() => expect(actions.removeBackgroundImage).toHaveBeenCalled());
    expect(actions.saveAppearance).not.toHaveBeenCalled();
  });
});

describe("saving", () => {
  it("sends the chosen background", async () => {
    const user = userEvent.setup();
    render(<BackgroundPicker selected="plain" uploadedImageUrl={null} />);

    await user.click(swatch(/morning glow/i));
    await user.click(screen.getByRole("button", { name: "Save background" }));

    await waitFor(() => expect(actions.saveAppearance).toHaveBeenCalled());
    expect((actions.saveAppearance.mock.calls[0][0] as FormData).get("backgroundId")).toBe(
      "sunburst",
    );
  });

  it("offers a look at the real menu", () => {
    render(<BackgroundPicker selected="plain" uploadedImageUrl={null} />);
    expect(screen.getByRole("link", { name: /preview on a phone/i })).toHaveAttribute(
      "href",
      "/preview",
    );
  });
});
