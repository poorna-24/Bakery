import { prisma } from "./db";
import { DEFAULT_APPEARANCE, SETTING_KEYS, toAppearance, type Appearance } from "./backgrounds";

/**
 * The background chosen under Appearance, for the dashboard to wear as well as
 * the menu — so the owner sees their shop's look while they work.
 *
 * Never throws. The dashboard layout wraps the login page too, and a database
 * hiccup must cost the background, not the ability to sign in.
 */
export async function loadAppearance(): Promise<Appearance> {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: Object.values(SETTING_KEYS) } },
    });
    return toAppearance(rows);
  } catch {
    return DEFAULT_APPEARANCE;
  }
}
