import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Backdrop from "./Backdrop";
import { DEFAULT_APPEARANCE } from "@/lib/backgrounds";

describe("Backdrop", () => {
  it("renders nothing for the plain background", () => {
    const { container } = render(<Backdrop appearance={DEFAULT_APPEARANCE} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("applies the pattern class the owner chose", () => {
    const { container } = render(
      <Backdrop appearance={{ backgroundId: "scallops", backgroundImageUrl: null }} />,
    );
    expect(container.querySelector(".pattern-scallops")).toBeInTheDocument();
  });

  it("shows an uploaded photo", () => {
    const { container } = render(
      <Backdrop appearance={{ backgroundId: "custom", backgroundImageUrl: "/uploads/a.jpg" }} />,
    );
    const layer = container.querySelector<HTMLElement>('[style*="background-image"]');
    expect(layer?.style.backgroundImage).toContain("/uploads/a.jpg");
  });

  // The regression this guards: the scrim was written with a Tailwind opacity
  // modifier on a CSS variable, which renders no background at all and left
  // dark text sitting on a photo.
  it("puts a scrim over an uploaded photo so the menu stays readable", () => {
    const { container } = render(
      <Backdrop appearance={{ backgroundId: "custom", backgroundImageUrl: "/uploads/a.jpg" }} />,
    );
    expect(container.querySelector(".scrim")).toBeInTheDocument();
  });

  it("renders nothing when the photo is selected but missing", () => {
    const { container } = render(
      <Backdrop appearance={{ backgroundId: "custom", backgroundImageUrl: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("stays out of the way of taps", () => {
    const { container } = render(
      <Backdrop appearance={{ backgroundId: "dots", backgroundImageUrl: null }} />,
    );
    const layer = container.firstElementChild;
    expect(layer).toHaveClass("pointer-events-none");
    expect(layer).toHaveAttribute("aria-hidden", "true");
  });
});
