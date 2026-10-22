import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { VendorNotificationPreferences } from "@/lib/api";
import { getVendorNotificationPreferences, patchVendorNotifications } from "@/lib/api";

import NotificationSettingsPage from "./NotificationsClient";

const wallet = vi.hoisted(() => ({
  token: "token-a" as string | null,
  connect: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({
  default: () => wallet,
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
    expect(saveButton()).toBeDisabled();
  });

  it("clears a prior error as soon as a new load starts", async () => {
    const retry = deferred<VendorNotificationPreferences>();
    getPrefs.mockRejectedValueOnce(new Error("network")).mockReturnValueOnce(retry.promise);

    render(<NotificationSettingsPage />);
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await act(async () => retry.resolve(prefs(false)));
    expect(saveButton()).toBeDisabled();
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
    expect(saveButton()).toBeDisabled();
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

  it("shows connection guidance and clears prior preferences after disconnect", async () => {
    getPrefs.mockResolvedValue(prefs(true));
    const { rerender } = render(<NotificationSettingsPage />);
    expect(await screen.findByRole("switch", { name: "Funded email" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    wallet.token = null;
    rerender(<NotificationSettingsPage />);

    expect(await screen.findByText("Connect your wallet to manage notification preferences.")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("loads preferences after connecting and keeps unchanged preferences unsaveable", async () => {
    wallet.token = null;
    const pending = deferred<VendorNotificationPreferences>();
    getPrefs.mockReturnValue(pending.promise);
    const { rerender } = render(<NotificationSettingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect wallet" }));
    expect(wallet.connect).toHaveBeenCalledTimes(1);

    wallet.token = "token-b";
    rerender(<NotificationSettingsPage />);
    expect(getPrefs).toHaveBeenCalledWith("token-b");
    expect(saveButton()).toBeDisabled();

    await act(async () => pending.resolve(prefs(true)));
    expect(fundedEmail()).toHaveAttribute("aria-checked", "true");
    expect(saveButton()).toBeDisabled();
  });
});

describe("NotificationSettingsPage unsaved changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wallet.token = "token-a";
    getPrefs.mockResolvedValue(prefs(false));
  });

  it("discards edits and disables redundant saves", async () => {
    render(<NotificationSettingsPage />);
    await screen.findByRole("switch", { name: "Funded email" });
    expect(saveButton()).toBeDisabled();
    fireEvent.click(fundedEmail());
    expect(saveButton()).toBeEnabled();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(fundedEmail()).toHaveAttribute("aria-checked", "false");
    expect(saveButton()).toBeDisabled();
  });

  it("keeps edits made during a save dirty and discards to the submitted snapshot", async () => {
    const pending = deferred<void>();
    vi.mocked(patchVendorNotifications).mockReturnValueOnce(pending.promise);
    render(<NotificationSettingsPage />);
    await screen.findByRole("switch", { name: "Funded email" });
    fireEvent.click(fundedEmail());
    fireEvent.click(saveButton());
    expect(patchVendorNotifications).toHaveBeenCalledWith(prefs(true), "token-a");
    fireEvent.click(fundedEmail());
    await act(async () => pending.resolve());
    expect(fundedEmail()).toHaveAttribute("aria-checked", "false");
    expect(saveButton()).toBeEnabled();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(fundedEmail()).toHaveAttribute("aria-checked", "true");
    expect(saveButton()).toBeDisabled();
  });

  it("preserves unsaved edits when saving fails", async () => {
    vi.mocked(patchVendorNotifications).mockRejectedValueOnce(new Error("network"));
    render(<NotificationSettingsPage />);
    await screen.findByRole("switch", { name: "Funded email" });
    fireEvent.click(fundedEmail());
    await act(async () => fireEvent.click(saveButton()));
    expect(saveButton()).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(fundedEmail()).toHaveAttribute("aria-checked", "false");
  });

  it("ignores save completion after switching wallets", async () => {
    const pending = deferred<void>();
    vi.mocked(patchVendorNotifications).mockReturnValueOnce(pending.promise);
    const { rerender } = render(<NotificationSettingsPage />);
    await screen.findByRole("switch", { name: "Funded email" });
    fireEvent.click(fundedEmail());
    fireEvent.click(saveButton());
    wallet.token = "token-b";
    await act(async () => rerender(<NotificationSettingsPage />));
    await act(async () => pending.resolve());
    expect(fundedEmail()).toHaveAttribute("aria-checked", "false");
    expect(saveButton()).toBeDisabled();
  });
});
