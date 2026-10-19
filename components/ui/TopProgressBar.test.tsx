import { act, render, screen } from "@testing-library/react";
import { usePathname, useSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TopProgressBar from "./TopProgressBar";

function clickWithoutNavigation(link: HTMLElement) {
  const preventDefault = (event: Event) => event.preventDefault();
  document.addEventListener("click", preventDefault, { once: true });
  act(() => {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    link.dispatchEvent(event);
  });
}

describe("TopProgressBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(usePathname).mockReturnValue("/");
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps progress visible while a navigation is pending", () => {
    render(
      <>
        <TopProgressBar />
        <a href="/next">Go to next page</a>
      </>
    );

    clickWithoutNavigation(screen.getByRole("link", { name: "Go to next page" }));
    act(() => vi.advanceTimersByTime(1_200));

    expect(document.querySelector(".fixed.top-0")).toBeInTheDocument();
  });

  it.each([
    ["/next", ""],
    ["/", "?filter=active"],
  ])("completes after the URL commits to %s%s", (pathname, query) => {
    const href = `${pathname}${query}`;
    const { rerender } = render(
      <>
        <TopProgressBar />
        <a href={href}>Navigate</a>
      </>
    );

    clickWithoutNavigation(screen.getByRole("link", { name: "Navigate" }));
    vi.mocked(usePathname).mockReturnValue(pathname);
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams(query.replace(/^\?/, "")) as never
    );
    rerender(
      <>
        <TopProgressBar />
        <a href={href}>Navigate</a>
      </>
    );

    expect(document.querySelector(".fixed.top-0 div")).toHaveStyle({ width: "100%" });
    act(() => vi.advanceTimersByTime(300));
    expect(document.querySelector(".fixed.top-0")).not.toBeInTheDocument();
  });

  it("clears an abandoned navigation and its timers", () => {
    render(
      <>
        <TopProgressBar />
        <a href="/cancelled">Navigate</a>
      </>
    );
    clickWithoutNavigation(screen.getByRole("link", { name: "Navigate" }));

    act(() => vi.advanceTimersByTime(30_000));

    expect(document.querySelector(".fixed.top-0")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up active timers when unmounted", () => {
    const { unmount } = render(
      <>
        <TopProgressBar />
        <a href="/next">Navigate</a>
      </>
    );
    const baselineTimerCount = vi.getTimerCount();
    clickWithoutNavigation(screen.getByRole("link", { name: "Navigate" }));

    unmount();

    expect(vi.getTimerCount()).toBe(baselineTimerCount);
  });
});