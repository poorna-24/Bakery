// Validation for "paste a link" image uploads.
//
// The owner types an address and the server fetches it. That is a request made
// by our server, to wherever the text says — so the address has to be checked
// before anything is fetched. Without this, a typed URL could be aimed at
// something only the server can reach: a database on localhost, or a cloud
// provider's metadata endpoint. Only the shop owner can reach this form, but
// "only a trusted person can trigger it" is not a reason to leave it open.

export type UrlCheck = { ok: true; url: URL } | { ok: false; error: string };

/** Hostnames that always point back at the machine doing the fetching. */
const LOOPBACK_NAMES = new Set(["localhost", "localhost.localdomain", "ip6-localhost"]);

/**
 * Address ranges that are not reachable from the public internet, so a link to
 * one can only be an attempt to reach something private — or a mistake.
 */
function isPrivateAddress(host: string): boolean {
  const lower = host.toLowerCase();

  if (LOOPBACK_NAMES.has(lower)) return true;
  // .local and .internal are resolved on private networks only.
  if (lower.endsWith(".local") || lower.endsWith(".internal")) return true;

  // IPv6 loopback and unique-local, with or without brackets.
  const v6 = lower.replace(/^\[|\]$/g, "");
  if (v6 === "::1" || v6 === "::") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(v6)) return true;
  // ::ffff:127.0.0.1 maps IPv4 into IPv6. The URL parser rewrites it to hex —
  // ::ffff:7f00:1 — so the dotted form alone never matches and the address
  // would sail through as public. Both spellings have to be understood.
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (dotted) return isPrivateAddress(dotted[1]);

  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v6);
  if (hex) {
    const high = Number.parseInt(hex[1], 16);
    const low = Number.parseInt(hex[2], 16);
    return isPrivateAddress(
      [high >> 8, high & 0xff, low >> 8, low & 0xff].join("."),
    );
  }

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower);
  if (!v4) return false;

  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (v4.slice(1).some((part) => Number(part) > 255)) return true; // malformed

  if (a === 127 || a === 0) return true; // loopback, "this network"
  if (a === 10) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast and reserved

  return false;
}

/**
 * Checks a pasted image address before the server goes anywhere near it.
 *
 * Returns a plain message on failure — it is shown to the shop owner, who is
 * not going to be helped by "ERR_INVALID_URL".
 */
export function checkImageUrl(raw: string): UrlCheck {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Paste an image link first." };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "That does not look like a link. It should start with https://" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Only https:// links can be used." };
  }

  if (isPrivateAddress(url.hostname)) {
    return { ok: false, error: "That link points at a private address, so it cannot be fetched." };
  }

  // A Google Images results page is not an image. People paste these constantly
  // — the address bar while browsing results, rather than the picture itself.
  if (/^(www\.)?google\.[a-z.]+$/i.test(url.hostname) && url.pathname.startsWith("/search")) {
    return {
      ok: false,
      error:
        "That is a search results page, not an image. Open the picture, then right-click it and choose “Copy image address”.",
    };
  }

  return { ok: true, url };
}

/**
 * Pulls the real picture out of a Google wrapper address.
 *
 * Right-clicking a thumbnail in Google Images and choosing "Copy link address"
 * gives a google.com/imgres link, not the picture: the actual address is inside
 * its `imgurl` parameter. A share.google short link redirects to the same
 * thing. Unwrapping it means the obvious copy-paste works instead of failing
 * with "that is a page, not an image".
 *
 * Returns null when this is not a wrapper, so callers can carry on unchanged.
 */
export function unwrapGoogleImageUrl(url: URL): URL | null {
  if (!/(^|\.)google\.[a-z.]+$/i.test(url.hostname)) return null;
  if (!url.pathname.startsWith("/imgres")) return null;

  const inner = url.searchParams.get("imgurl");
  if (!inner) return null;

  try {
    return new URL(inner);
  } catch {
    return null;
  }
}

/**
 * Short links that hide where they actually go, so the destination can only be
 * discovered by following them.
 */
export function isShortLink(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return ["share.google", "goo.gl", "g.co", "images.app.goo.gl"].includes(host);
}

/** True when the response really is an image we are willing to store. */
export function isAcceptableImageType(contentType: string | null): boolean {
  if (!contentType) return false;
  const type = contentType.split(";")[0].trim().toLowerCase();
  return ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].includes(type);
}
