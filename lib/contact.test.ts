import { describe, expect, it } from "vitest";
import { itemEnquiry, normalisePhone, telHref, whatsappHref } from "./contact";

describe("normalisePhone", () => {
  it("strips the spaces owners actually type", () => {
    expect(normalisePhone("+91 76660 93143")).toBe("+917666093143");
  });

  it("strips dashes and brackets too", () => {
    expect(normalisePhone("+91 (766) 60-93143")).toBe("+917666093143");
  });

  it("keeps a number with no plus as it is", () => {
    expect(normalisePhone("7666093143")).toBe("7666093143");
  });

  it("returns empty for blank or junk input, so the buttons stay hidden", () => {
    expect(normalisePhone("")).toBe("");
    expect(normalisePhone("   ")).toBe("");
    expect(normalisePhone("call us!")).toBe("");
  });
});

describe("telHref", () => {
  it("builds a dialable link", () => {
    expect(telHref("+91 76660 93143")).toBe("tel:+917666093143");
  });

  it("is null when no number is set", () => {
    expect(telHref("")).toBeNull();
  });
});

describe("whatsappHref", () => {
  it("drops the plus, which wa.me does not accept", () => {
    expect(whatsappHref("+91 76660 93143")).toBe("https://wa.me/917666093143");
  });

  it("adds the country code to a bare ten-digit mobile", () => {
    expect(whatsappHref("7666093143")).toBe("https://wa.me/917666093143");
  });

  it("replaces a local leading zero with the country code", () => {
    expect(whatsappHref("076660 93143")).toBe("https://wa.me/917666093143");
  });

  it("leaves an already complete number alone", () => {
    expect(whatsappHref("917666093143")).toBe("https://wa.me/917666093143");
  });

  it("url-encodes the prefilled message", () => {
    const href = whatsappHref("+917666093143", "Hi there & thanks!");
    expect(href).toBe("https://wa.me/917666093143?text=Hi%20there%20%26%20thanks!");
  });

  it("is null when no number is set", () => {
    expect(whatsappHref("")).toBeNull();
  });

  it("produces a link WhatsApp can parse", () => {
    const href = whatsappHref("+91 76660 93143", 'Choco "Truffle" Cake');
    const url = new URL(href!);
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/917666093143");
    expect(url.searchParams.get("text")).toBe('Choco "Truffle" Cake');
  });
});

describe("itemEnquiry", () => {
  it("names the shop and the item so the owner knows what is being asked about", () => {
    expect(itemEnquiry("SHIVAM BAKERY", "Choco Truffle Cake")).toContain("SHIVAM BAKERY");
    expect(itemEnquiry("SHIVAM BAKERY", "Choco Truffle Cake")).toContain("Choco Truffle Cake");
  });
});
