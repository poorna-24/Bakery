import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The cookie half of lib/auth.ts: issuing a session, reading it back, and
 * throwing it away. These run through next/headers, so the cookie store is
 * replaced with a plain in-memory one — the logic under test is the signing
 * and verifying, not Next's storage.
 */

type CookieRecord = { name: string; value: string; options?: Record<string, unknown> };

const store = new Map<string, CookieRecord>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => store.get(name),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      store.set(name, { name, value, options });
    },
    delete: (name: string) => {
      store.delete(name);
    },
  }),
}));

const {
  SESSION_COOKIE,
  createSession,
  currentUser,
  destroySession,
  verifyToken,
} = await import("./auth");

const originalSecret = process.env.SESSION_SECRET;

beforeEach(() => {
  store.clear();
  process.env.SESSION_SECRET = "a-long-enough-secret-for-signing-tokens";
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSecret;
});

describe("createSession", () => {
  it("stores a signed token under the session cookie", async () => {
    await createSession("owner@bakery.com");

    const cookie = store.get(SESSION_COOKIE);
    expect(cookie).toBeDefined();
    // A JWT is three dot-separated parts; the signature is the third.
    expect(cookie!.value.split(".")).toHaveLength(3);
  });

  it("marks the cookie httpOnly so scripts on the page cannot read it", async () => {
    await createSession("owner@bakery.com");
    expect(store.get(SESSION_COOKIE)!.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("expires the cookie rather than leaving it indefinitely", async () => {
    await createSession("owner@bakery.com");
    const maxAge = store.get(SESSION_COOKIE)!.options?.maxAge as number;
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(24 * 60 * 60);
  });

  // Over plain http a browser refuses a secure cookie, so the login would
  // silently never stay signed in. It has to follow the environment.
  it("only marks the cookie secure in production", async () => {
    const original = process.env.NODE_ENV;

    vi.stubEnv("NODE_ENV", "development");
    await createSession("owner@bakery.com");
    expect(store.get(SESSION_COOKIE)!.options?.secure).toBe(false);

    store.clear();
    vi.stubEnv("NODE_ENV", "production");
    await createSession("owner@bakery.com");
    expect(store.get(SESSION_COOKIE)!.options?.secure).toBe(true);

    vi.unstubAllEnvs();
    if (original !== undefined) vi.stubEnv("NODE_ENV", original);
  });
});

describe("verifyToken", () => {
  it("returns the email from a token it issued", async () => {
    await createSession("owner@bakery.com");
    const token = store.get(SESSION_COOKIE)!.value;

    expect(await verifyToken(token)).toBe("owner@bakery.com");
  });

  it("rejects a token that is not a token", async () => {
    expect(await verifyToken("not-a-jwt")).toBeNull();
  });

  it("rejects an empty token", async () => {
    expect(await verifyToken("")).toBeNull();
  });

  // The whole point of signing: a token minted with a different secret must
  // not be accepted, or anyone could forge a login.
  it("rejects a token signed with a different secret", async () => {
    await createSession("owner@bakery.com");
    const token = store.get(SESSION_COOKIE)!.value;

    process.env.SESSION_SECRET = "a-completely-different-secret-value!!";
    expect(await verifyToken(token)).toBeNull();
  });

  it("rejects a token whose payload has been tampered with", async () => {
    await createSession("owner@bakery.com");
    const [header, , signature] = store.get(SESSION_COOKIE)!.value.split(".");

    const forged = Buffer.from(JSON.stringify({ email: "intruder@evil.com" }))
      .toString("base64url");

    expect(await verifyToken(`${header}.${forged}.${signature}`)).toBeNull();
  });
});

describe("currentUser", () => {
  it("is null when nobody is signed in", async () => {
    expect(await currentUser()).toBeNull();
  });

  it("returns the signed-in email", async () => {
    await createSession("owner@bakery.com");
    expect(await currentUser()).toBe("owner@bakery.com");
  });

  it("is null when the cookie holds something invalid", async () => {
    store.set(SESSION_COOKIE, { name: SESSION_COOKIE, value: "garbage" });
    expect(await currentUser()).toBeNull();
  });
});

describe("destroySession", () => {
  it("removes the cookie, so the next request is signed out", async () => {
    await createSession("owner@bakery.com");
    expect(await currentUser()).toBe("owner@bakery.com");

    await destroySession();
    expect(store.has(SESSION_COOKIE)).toBe(false);
    expect(await currentUser()).toBeNull();
  });
});

describe("when SESSION_SECRET is unusable", () => {
  // Starting up with no secret, or a trivially short one, would mean tokens
  // anybody could forge. Better to fail loudly than to sign with nothing.
  it("refuses to issue a session with no secret set", async () => {
    delete process.env.SESSION_SECRET;
    await expect(createSession("owner@bakery.com")).rejects.toThrow(/SESSION_SECRET/);
  });

  it("refuses a secret too short to be worth anything", async () => {
    process.env.SESSION_SECRET = "short";
    await expect(createSession("owner@bakery.com")).rejects.toThrow(/too short/);
  });

  it("treats a token as invalid rather than throwing when the secret is gone", async () => {
    await createSession("owner@bakery.com");
    const token = store.get(SESSION_COOKIE)!.value;

    delete process.env.SESSION_SECRET;
    expect(await verifyToken(token)).toBeNull();
  });
});
