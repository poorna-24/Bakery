import { describe, expect, it } from "vitest";
import {
  OFFER_KEYS,
  OFFER_TONES,
  isOfferTone,
  offerToneClass,
  toOffer,
  toOfferDraft,
} from "./offer";

const rows = (entries: Record<string, string>) =>
  Object.entries(entries).map(([key, value]) => ({ key, value }));

describe("the tone catalogue", () => {
  it("has unique ids, or the picker would highlight two at once", () => {
    const ids = OFFER_TONES.map((tone) => tone.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every tone a real class to paint with", () => {
    for (const tone of OFFER_TONES) {
      expect(tone.className).toMatch(/^offer-[a-z]+$/);
      expect(tone.label.length).toBeGreaterThan(0);
      expect(tone.description.length).toBeGreaterThan(0);
    }
  });
});

describe("isOfferTone", () => {
  it("accepts a real tone", () => {
    expect(isOfferTone("gold")).toBe(true);
  });

  it("rejects anything else, so a hand-edited form cannot inject a class", () => {
    expect(isOfferTone("rainbow")).toBe(false);
    expect(isOfferTone("")).toBe(false);
  });
});

describe("offerToneClass", () => {
  it("maps a tone to its class", () => {
    expect(offerToneClass("fresh")).toBe("offer-fresh");
  });
});

describe("toOffer", () => {
  it("is null when the owner has never written one", () => {
    expect(toOffer([])).toBeNull();
  });

  it("is null when the text is blank or only spaces", () => {
    expect(toOffer(rows({ [OFFER_KEYS.text]: "" }))).toBeNull();
    expect(toOffer(rows({ [OFFER_KEYS.text]: "   " }))).toBeNull();
  });

  it("reads a saved offer", () => {
    expect(
      toOffer(
        rows({
          [OFFER_KEYS.text]: "Diwali special — 20% off all sweets",
          [OFFER_KEYS.note]: "Till 5 November",
          [OFFER_KEYS.tone]: "gold",
        }),
      ),
    ).toEqual({
      text: "Diwali special — 20% off all sweets",
      note: "Till 5 November",
      tone: "gold",
      isVisible: true,
    });
  });

  // Hiding must keep the text: the same message comes back next festival.
  it("is null when hidden, even though the text is still stored", () => {
    expect(
      toOffer(
        rows({
          [OFFER_KEYS.text]: "Diwali special",
          [OFFER_KEYS.isVisible]: "false",
        }),
      ),
    ).toBeNull();
  });

  it("shows an offer saved before the visibility flag existed", () => {
    expect(toOffer(rows({ [OFFER_KEYS.text]: "Fresh cakes daily" }))?.isVisible).toBe(true);
  });

  it("falls back to the festive tone when the stored one is unknown", () => {
    expect(
      toOffer(rows({ [OFFER_KEYS.text]: "Hello", [OFFER_KEYS.tone]: "neon" }))?.tone,
    ).toBe("festive");
  });

  it("trims stray whitespace off the text and note", () => {
    const offer = toOffer(
      rows({ [OFFER_KEYS.text]: "  Sale  ", [OFFER_KEYS.note]: "  today only  " }),
    );
    expect(offer?.text).toBe("Sale");
    expect(offer?.note).toBe("today only");
  });

  it("leaves the note empty when none was written", () => {
    expect(toOffer(rows({ [OFFER_KEYS.text]: "Sale" }))?.note).toBe("");
  });
});

describe("toOfferDraft", () => {
  // The admin form must still show a hidden offer, so it can be brought back.
  it("returns a hidden offer so the form can show and restore it", () => {
    expect(
      toOfferDraft(
        rows({
          [OFFER_KEYS.text]: "Diwali special",
          [OFFER_KEYS.isVisible]: "false",
          [OFFER_KEYS.tone]: "berry",
        }),
      ),
    ).toEqual({ text: "Diwali special", note: "", tone: "berry", isVisible: false });
  });

  it("gives sensible defaults for a first-time form", () => {
    expect(toOfferDraft([])).toEqual({ text: "", note: "", tone: "festive", isVisible: true });
  });
});
