// Shared file. An identical copy lives in bakery-admin/lib/backgrounds.ts.
//
// The built-in backgrounds. Every one is drawn with CSS gradients rather than
// an image file: nothing to download, sharp on any screen, and each adapts to
// light and dark mode on its own. The matching CSS classes are defined in both
// apps' globals.css — add one here and you must add the class in both.
//
// Photographs are deliberately not shipped here. Stock images found online are
// almost always someone's copyrighted work, and a shop's public menu is the
// wrong place to gamble on that. The owner uploads their own instead.

export type BackgroundId = "plain" | "dots" | "scallops" | "linen" | "sunburst" | "custom";

export type BackgroundOption = {
  id: BackgroundId;
  label: string;
  description: string;
  /** The CSS class that paints it. Empty for plain and for uploads. */
  className: string;
};

export const BACKGROUNDS: BackgroundOption[] = [
  {
    id: "plain",
    label: "Plain",
    description: "Just the warm cream base. Cleanest, fastest, never fights the photos.",
    className: "",
  },
  {
    id: "dots",
    label: "Polka dots",
    description: "A fine dot grid. Quiet texture that stays out of the way.",
    className: "pattern-dots",
  },
  {
    id: "scallops",
    label: "Piped icing",
    description: "Rows of soft arcs, like piping on a cake edge.",
    className: "pattern-scallops",
  },
  {
    id: "linen",
    label: "Linen weave",
    description: "A woven cross-hatch. Reads like a tablecloth under the menu.",
    className: "pattern-linen",
  },
  {
    id: "sunburst",
    label: "Morning glow",
    description: "A warm light spilling from the top of the page.",
    className: "pattern-sunburst",
  },
  {
    id: "custom",
    label: "Your own photo",
    description: "Upload a picture of the shop or the counter. Dimmed so prices stay readable.",
    className: "",
  },
];

export const SETTING_KEYS = {
  backgroundId: "background.id",
  backgroundImageUrl: "background.imageUrl",
} as const;

export type Appearance = {
  backgroundId: BackgroundId;
  backgroundImageUrl: string | null;
};

export const DEFAULT_APPEARANCE: Appearance = {
  backgroundId: "plain",
  backgroundImageUrl: null,
};

export function isBackgroundId(value: string): value is BackgroundId {
  return BACKGROUNDS.some((option) => option.id === value);
}

export function backgroundClass(id: BackgroundId): string {
  return BACKGROUNDS.find((option) => option.id === id)?.className ?? "";
}

/**
 * Turns stored rows into settings the UI can use. Falls back to plain when the
 * owner picked "your own photo" and then deleted it, so the page never renders
 * a broken image.
 */
export function toAppearance(rows: { key: string; value: string }[]): Appearance {
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const storedId = map.get(SETTING_KEYS.backgroundId) ?? "";
  const imageUrl = map.get(SETTING_KEYS.backgroundImageUrl) || null;
  const id: BackgroundId = isBackgroundId(storedId) ? storedId : DEFAULT_APPEARANCE.backgroundId;

  if (id === "custom" && !imageUrl) return DEFAULT_APPEARANCE;

  return { backgroundId: id, backgroundImageUrl: imageUrl };
}
