import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Navbar from "./Navbar";

const { route } = vi.hoisted(() => ({ route: { pathname: "/dashboard" } }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/components/providers/NetworkProvider", () => ({ useNetwork: () => ({ toggleNetwork: vi.fn(), isMainnet: false }) }));
vi.mock("@/components/ui/ThemeToggle", () => ({ default: () => <button>Theme</button> }));

describe("desktop navigation", () => {
  it("exposes all core destinations alongside the existing controls", () => {
    render(<Navbar />);
    expect(screen.getByRole("navigation", { name: "Desktop navigation" })).toHaveClass("hidden", "md:flex");
    for (const [label, href] of [["Dashboard", "/dashboard"], ["Create Link", "/create"], ["Track Order", "/tracking"], ["Inbox", "/notifications"], ["Profile", "/profile"]]) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
    expect(screen.getByRole("switch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Theme" })).toBeInTheDocument();
  });

  it.each([["/dashboard/analytics", "Dashboard"], ["/track/order", "Track Order"], ["/settings/profile", "Profile"]])("marks %s as the current destination", (pathname, label) => {
    route.pathname = pathname;
    render(<Navbar />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page")).toHaveLength(1);
  });
});
