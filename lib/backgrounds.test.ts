import { describe, expect, it } from "vitest";
import {
  BACKGROUNDS,
  DEFAULT_APPEARANCE,
  SETTING_KEYS,
  backgroundClass,
  isBackgroundId,
  toAppearance,
} from "./backgrounds";

describe("the catalogue", () => {
  it("has unique ids, or the picker would highlight two cards at once", () => {
    const ids = BACKGROUNDS.map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every option a label and a description for the picker", () => {
    for (const option of BACKGROUNDS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.description.length).toBeGreaterThan(0);
    }
  });

  it("leaves the class empty only for plain and the uploaded photo", () => {
    // Every other option must name a real CSS class or it would paint nothing.
    for (const option of BACKGROUNDS) {
      if (option.id === "plain" || option.id === "custom") {
        expect(option.className).toBe("");
      } else {
        expect(option.className).toMatch(/^pattern-[a-z]+$/);
      }
    }
  });
});

describe("isBackgroundId", () => {
  it("accepts a real id", () => {
    expect(isBackgroundId("scallops")).toBe(true);
  });

  it("rejects anything else, so a hand-edited form cannot set a bogus value", () => {
    expect(isBackgroundId("dropTable")).toBe(false);
    expect(isBackgroundId("")).toBe(false);
  });
});

describe("backgroundClass", () => {
  it("returns the class for a pattern", () => {
    expect(backgroundClass("dots")).toBe("pattern-dots");
  });

  it("returns nothing for plain", () => {
    expect(backgroundClass("plain")).toBe("");
  });
});

describe("toAppearance", () => {
  it("falls back to plain when nothing has ever been saved", () => {
    expect(toAppearance([])).toEqual(DEFAULT_APPEARANCE);
  });

  it("reads a saved pattern", () => {
    expect(toAppearance([{ key: SETTING_KEYS.backgroundId, value: "linen" }])).toEqual({
      backgroundId: "linen",
      backgroundImageUrl: null,
    });
  });

  it("ignores an unknown id rather than rendering a broken page", () => {
    expect(toAppearance([{ key: SETTING_KEYS.backgroundId, value: "nonsense" }])).toEqual(
      DEFAULT_APPEARANCE,
    );
  });

  it("reads the photo when one is selected", () => {
    expect(
      toAppearance([
        { key: SETTING_KEYS.backgroundId, value: "custom" },
        { key: SETTING_KEYS.backgroundImageUrl, value: "/uploads/a.jpg" },
      ]),
    ).toEqual({ backgroundId: "custom", backgroundImageUrl: "/uploads/a.jpg" });
  });

  // The failure this prevents: the owner picks their photo, deletes it later,
  // and the menu is left pointing at a file that is no longer there.
  it("falls back to plain when the photo is selected but missing", () => {
    expect(toAppearance([{ key: SETTING_KEYS.backgroundId, value: "custom" }])).toEqual(
      DEFAULT_APPEARANCE,
    );
  });

  it("treats an empty stored url as no photo", () => {
    expect(
      toAppearance([
        { key: SETTING_KEYS.backgroundId, value: "custom" },
        { key: SETTING_KEYS.backgroundImageUrl, value: "" },
      ]),
    ).toEqual(DEFAULT_APPEARANCE);
  });

  it("keeps an uploaded photo on record while a pattern is shown", () => {
    // So the picker can still offer the photo back without a re-upload.
    expect(
      toAppearance([
        { key: SETTING_KEYS.backgroundId, value: "dots" },
        { key: SETTING_KEYS.backgroundImageUrl, value: "/uploads/a.jpg" },
      ]),
    ).toEqual({ backgroundId: "dots", backgroundImageUrl: "/uploads/a.jpg" });
  });
});
