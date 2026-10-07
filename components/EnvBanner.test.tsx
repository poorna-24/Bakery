// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import EnvBanner from "./EnvBanner";

describe("EnvBanner", () => {
  it("names the environment on a test site", () => {
    render(<EnvBanner label="qa" />);
    expect(screen.getByText(/qa environment · not the live menu/i)).toBeInTheDocument();
  });

  // Production sets no label; a stray space must not put a banner on the live menu.
  it.each([undefined, "", "   "])("shows nothing for %j", (label) => {
    const { container } = render(<EnvBanner label={label} />);
    expect(container).toBeEmptyDOMElement();
  });
});
