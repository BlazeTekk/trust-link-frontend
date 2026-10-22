import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getVendorEscrows } from "@/lib/api";
import { deriveNotifications } from "@/lib/notifications";

import { NotificationProvider, useNotifications } from "./NotificationProvider";

vi.mock("@/lib/api", () => ({ getVendorEscrows: vi.fn() }));
vi.mock("@/lib/notifications", () => ({
  deriveNotifications: vi.fn(),
  getReadIds: () => new Set<string>(),
  saveReadIds: vi.fn(),
}));

const wrapper = ({ children }: { children: ReactNode }) => <NotificationProvider>{children}</NotificationProvider>;

describe("notification fetch recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("wallet.jwt", "token");
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("distinguishes initial failure, recovers, and retains stale notifications", async () => {
    const interval = vi.spyOn(globalThis, "setInterval");
    vi.mocked(getVendorEscrows)
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("Refresh failed"))
      .mockResolvedValueOnce([]);
    vi.mocked(deriveNotifications).mockReturnValue([
      { id: "event", escrowId: "escrow", escrowItem: "Order", type: "FUNDED", message: "Paid", timestamp: "2026-01-01T00:00:00Z" },
    ]);
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.error?.message).toBe("Offline"));
    expect(result.current.hasLoaded).toBe(false);
    await act(() => result.current.refetch());
    expect(result.current.error).toBeNull();
    expect(result.current.notifications).toHaveLength(1);
    await act(() => result.current.refetch());
    expect(result.current.error?.message).toBe("Refresh failed");
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.notifications).toHaveLength(1);
    await act(() => result.current.refetch());
    expect(result.current.error).toBeNull();
    expect(interval.mock.calls.filter(([, delay]) => delay === 30_000)).toHaveLength(1);
  });

  it("does not overlap a pending fetch with a retry", async () => {
    let resolveRequest!: (value: Awaited<ReturnType<typeof getVendorEscrows>>) => void;
    vi.mocked(getVendorEscrows).mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    vi.mocked(deriveNotifications).mockReturnValue([]);
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await act(() => result.current.refetch());
    expect(getVendorEscrows).toHaveBeenCalledTimes(1);
    await act(async () => { resolveRequest([]); });
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });
});
