import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProfileSettingsClient from "./ProfileSettingsClient";

vi.mock("@/hooks/useWallet", () => ({
  default: () => ({ publicKey: null }),
}));

const STORAGE_KEY = "vendor.profile";

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

describe("ProfileSettingsClient stored profile hydration", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // React reports controlled/uncontrolled switches through console.error.
    const warnings = consoleError.mock.calls
      .map((args: unknown[]) => String(args[0]))
      .filter((msg: string) => /controlled|uncontrolled/i.test(msg));
    expect(warnings).toEqual([]);
    vi.restoreAllMocks();
  });

  it("hydrates a partial profile with defaults for omitted fields", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ businessName: "Acme" }));
    render(<ProfileSettingsClient />);

    await waitFor(() => expect(field(/Business Name/)).toHaveValue("Acme"));
    expect(field(/Display Name/)).toHaveValue("");
    expect(field(/Contact Email/)).toHaveValue("");
    expect(field(/Short Bio/)).toHaveValue("");

    fireEvent.change(field(/Display Name/), { target: { value: "@acme" } });
    save();
    expect(screen.getByText("Profile saved.")).toBeInTheDocument();
  });

  it.each([
    ["null", "null"],
    ["an array", JSON.stringify(["Acme"])],
    ["a number", "42"],
    ["a string", JSON.stringify("Acme")],
  ])("ignores %s stored profile without crashing", (_label, raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    render(<ProfileSettingsClient />);

    expect(field(/Business Name/)).toHaveValue("");
    expect(() => save()).not.toThrow();
    expect(screen.getByText("Business name is required.")).toBeInTheDocument();
  });

  it("drops wrong-type and unknown fields and still validates and saves", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        businessName: 123,
        displayName: null,
        email: { value: "x" },
        bio: "Hello",
        extra: "ignored",
      }),
    );
    render(<ProfileSettingsClient />);

    await waitFor(() => expect(field(/Short Bio/)).toHaveValue("Hello"));
    expect(field(/Business Name/)).toHaveValue("");
    expect(field(/Display Name/)).toHaveValue("");
    expect(field(/Contact Email/)).toHaveValue("");

    expect(() => save()).not.toThrow();
    expect(screen.getByText("Business name is required.")).toBeInTheDocument();

    fireEvent.change(field(/Business Name/), { target: { value: "Acme" } });
    save();
    expect(screen.getByText("Profile saved.")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      businessName: "Acme",
      displayName: "",
      email: "",
      bio: "Hello",
    });
  });
});
