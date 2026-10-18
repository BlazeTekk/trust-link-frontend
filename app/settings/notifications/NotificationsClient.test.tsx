import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { VendorNotificationPreferences } from "@/lib/api";
import { getVendorNotificationPreferences } from "@/lib/api";

import NotificationSettingsPage from "./NotificationsClient";

const wallet = vi.hoisted(() => ({ token: "token-a" as string | null }));

vi.mock("@/hooks/useWallet", () => ({
  default: () => ({ token: wallet.token }),
}));

vi.mock("@/lib/api", () => ({
  getVendorNotificationPreferences: vi.fn(),
  patchVendorNotifications: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/notifications/EmailPreview", () => ({
  default: () => null,
}));

const getPrefs = getVendorNotificationPreferences as unknown as ReturnType<typeof vi.fn>;

function prefs(fundedEmail: boolean): VendorNotificationPreferences {
  const off = { email: false, sms: false };
  return {
    funded: { email: fundedEmail, sms: false },
    shipped: off,
    delivered: off,
    disputed: off,
    completed: off,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const fundedEmail = () => screen.getByRole("switch", { name: "Funded email" });
const saveButton = () => screen.getByRole("button", { name: "Save preferences" });

describe("NotificationSettingsPage preference loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wallet.token = "token-a";
  });

  it("retries a failed load and clears the error on success", async () => {
    getPrefs.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(prefs(true));

    render(<NotificationSettingsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load notification preferences.",
    );
    expect(saveButton()).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });

    expect(getPrefs).toHaveBeenCalledTimes(2);
    expect(getPrefs).toHaveBeenLastCalledWith("token-a");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fundedEmail()).toHaveAttribute("aria-checked", "true");
    expect(saveButton()).toBeEnabled();
  });

  it("clears a prior error as soon as a new load starts", async () => {
    const retry = deferred<VendorNotificationPreferences>();
    getPrefs.mockRejectedValueOnce(new Error("network")).mockReturnValueOnce(retry.promise);

    render(<NotificationSettingsPage />);
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await act(async () => retry.resolve(prefs(false)));
    expect(saveButton()).toBeEnabled();
  });

  it("ignores a late response for an obsolete token", async () => {
    const forA = deferred<VendorNotificationPreferences>();
    const forB = deferred<VendorNotificationPreferences>();
    getPrefs.mockImplementation((token: string) =>
      token === "token-a" ? forA.promise : forB.promise,
    );

    const { rerender } = render(<NotificationSettingsPage />);
    expect(getPrefs).toHaveBeenLastCalledWith("token-a");

    wallet.token = "token-b";
    rerender(<NotificationSettingsPage />);
    expect(getPrefs).toHaveBeenLastCalledWith("token-b");

    await act(async () => forB.resolve(prefs(false)));
    expect(fundedEmail()).toHaveAttribute("aria-checked", "false");

    // The superseded token-a response arrives last and must not win.
    await act(async () => forA.resolve(prefs(true)));
    expect(fundedEmail()).toHaveAttribute("aria-checked", "false");
    expect(saveButton()).toBeEnabled();
  });

  it("ignores a late failure for an obsolete token", async () => {
    const forA = deferred<VendorNotificationPreferences>();
    const forB = deferred<VendorNotificationPreferences>();
    getPrefs.mockImplementation((token: string) =>
      token === "token-a" ? forA.promise : forB.promise,
    );

    const { rerender } = render(<NotificationSettingsPage />);
    wallet.token = "token-b";
    rerender(<NotificationSettingsPage />);

    await act(async () => forA.reject(new Error("stale")));
    // The current load is still pending, so neither an error nor the controls show.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    await act(async () => forB.resolve(prefs(true)));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fundedEmail()).toHaveAttribute("aria-checked", "true");
  });
});
