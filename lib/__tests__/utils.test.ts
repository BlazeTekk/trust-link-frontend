import { describe, expect, it } from "vitest";

import { formatTimeAgo, UNAVAILABLE_DATE } from "@/lib/utils";

describe("formatTimeAgo", () => {
  it("returns a readable fallback for invalid dates", () => {
    expect(formatTimeAgo("not-a-date")).toBe(UNAVAILABLE_DATE);
    expect(formatTimeAgo(Number.NaN)).toBe(UNAVAILABLE_DATE);
  });

  it("keeps valid past and future dates localized", () => {
    const past = new Date(Date.now() - 2 * 60_000);
    const future = new Date(Date.now() + 2 * 60_000);

    expect(formatTimeAgo(past, "en")).toContain("ago");
    expect(formatTimeAgo(future, "fr")).toContain("dans");
  });
});