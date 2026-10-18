import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProfileSettingsClient from "./ProfileSettingsClient";

vi.mock("@/hooks/useWallet", () => ({
  default: () => ({ publicKey: null }),
}));

const STORAGE_KEY = "vendor.profile";

function fillAndSubmit(businessName: string) {
  fireEvent.change(screen.getByLabelText(/Business Name/), {
    target: { value: businessName },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
}

describe("ProfileSettingsClient storage failures", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["QuotaExceededError", /storage is full/i],
    ["SecurityError", /blocking site storage/i],
  ])("shows an inline error for %s and keeps edits", (name, message) => {
    const setItem = vi
      .spyOn(localStorage, "setItem")
      .mockImplementation(() => {
        throw new DOMException("denied", name);
      });

    render(<ProfileSettingsClient />);
    expect(() => fillAndSubmit("Acme Goods")).not.toThrow();

    expect(setItem).toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("Profile saved.")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Business Name/)).toHaveValue("Acme Goods");
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled();
  });

  it("clears the error and reports success after a successful retry", () => {
    const setItem = vi
      .spyOn(localStorage, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("full", "QuotaExceededError");
      });

    render(<ProfileSettingsClient />);
    fillAndSubmit("Acme Goods");
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(setItem).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Profile saved.")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject({
      businessName: "Acme Goods",
    });
  });

  it("falls back to a generic retry message for unknown errors", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("boom");
    });

    render(<ProfileSettingsClient />);
    fillAndSubmit("Acme Goods");

    expect(screen.getByRole("alert")).toHaveTextContent(/please try again/i);
    expect(screen.getByLabelText(/Business Name/)).toHaveValue("Acme Goods");
  });
});
