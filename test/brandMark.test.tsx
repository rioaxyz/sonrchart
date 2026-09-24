import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandMark } from "../src/BrandMark";

describe("BrandMark (#45)", () => {
  it("renders a text/children wordmark at the requested corner with opacity", () => {
    const { container } = render(
      <BrandMark position="bottom-right" opacity={0.4}>
        sonr
      </BrandMark>,
    );
    const el = container.querySelector(".sonr-brand") as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.className).toContain("sonr-brand-bottom-right");
    expect(el.style.opacity).toBe("0.4");
    expect(el).toHaveTextContent("sonr");
  });

  it("wraps in a new-tab link when href is given", () => {
    render(
      <BrandMark href="https://example.com" position="top-left">
        brand
      </BrandMark>,
    );
    const a = screen.getByRole("link", { name: "brand" });
    expect(a).toHaveAttribute("href", "https://example.com");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("renders an <img> logo when src is set", () => {
    render(<BrandMark src="logo.svg" alt="Acme" height={22} />);
    const img = screen.getByRole("img", { name: "Acme" }) as HTMLImageElement;
    expect(img).toHaveAttribute("src", "logo.svg");
    expect(img.style.height).toBe("22px");
  });
});
