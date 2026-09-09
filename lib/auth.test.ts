import { afterEach, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { checkCredentials } from "./auth";

// The one gate on the whole dashboard, so it gets the closest attention.
// Only checkCredentials is covered here: the rest of lib/auth.ts issues and
// reads cookies through next/headers, which needs a request to exist.

const original = { ...process.env };

beforeEach(() => {
  process.env.ADMIN_EMAIL = "owner@bakery.com";
  process.env.ADMIN_PASSWORD = "bakery123";
  delete process.env.ADMIN_PASSWORD_HASH;
});

afterEach(() => {
  process.env = { ...original };
});

describe("checkCredentials with a plain-text password", () => {
  it("accepts the right pair", async () => {
    expect(await checkCredentials("owner@bakery.com", "bakery123")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    expect(await checkCredentials("owner@bakery.com", "bakery124")).toBe(false);
  });

  it("rejects an unknown email", async () => {
    expect(await checkCredentials("someone@else.com", "bakery123")).toBe(false);
  });

  it("rejects both being wrong", async () => {
    expect(await checkCredentials("a@b.com", "nope")).toBe(false);
  });

  it("ignores the case and padding of the email, as a login form should", () => {
    return expect(checkCredentials("  Owner@Bakery.COM  ", "bakery123")).resolves.toBe(true);
  });

  it("does not ignore the case of the password", async () => {
    expect(await checkCredentials("owner@bakery.com", "BAKERY123")).toBe(false);
  });

  it("rejects an empty password", async () => {
    expect(await checkCredentials("owner@bakery.com", "")).toBe(false);
  });

  it("rejects a password that is a prefix of the real one", async () => {
    expect(await checkCredentials("owner@bakery.com", "bakery12")).toBe(false);
  });

  it("rejects a password with the right prefix and extra characters", async () => {
    expect(await checkCredentials("owner@bakery.com", "bakery1234")).toBe(false);
  });
});

describe("checkCredentials with a bcrypt hash", () => {
  beforeEach(() => {
    // What production is meant to use: the hash set, the plain one removed.
    process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("s3cret-live-password", 10);
    delete process.env.ADMIN_PASSWORD;
  });

  it("accepts the password behind the hash", async () => {
    expect(await checkCredentials("owner@bakery.com", "s3cret-live-password")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    expect(await checkCredentials("owner@bakery.com", "guess")).toBe(false);
  });

  it("rejects the right password with the wrong email", async () => {
    expect(await checkCredentials("intruder@bakery.com", "s3cret-live-password")).toBe(false);
  });
});

describe("checkCredentials when the hash and the plain password are both set", () => {
  it("uses the hash and ignores the leftover plain password", async () => {
    // Someone sets the hash for production but forgets to delete the old line.
    // The stale plain password must not still open the door.
    process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("new-password", 10);
    process.env.ADMIN_PASSWORD = "old-password";

    expect(await checkCredentials("owner@bakery.com", "old-password")).toBe(false);
    expect(await checkCredentials("owner@bakery.com", "new-password")).toBe(true);
  });
});

describe("checkCredentials when nothing is configured", () => {
  it("locks everyone out rather than letting an empty password through", async () => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD_HASH;

    expect(await checkCredentials("owner@bakery.com", "")).toBe(false);
    expect(await checkCredentials("", "")).toBe(false);
    expect(await checkCredentials("owner@bakery.com", "anything")).toBe(false);
  });
});
