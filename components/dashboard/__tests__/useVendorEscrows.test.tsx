import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getVendorEscrows } from "@/lib/api";
import type { Escrow } from "@/types";

import { useVendorEscrows } from "../useVendorEscrows";

vi.mock("@/lib/api", () => ({
  getVendorEscrows: vi.fn(),
}));

function escrow(id: string): Escrow {
  return {
    id,
    vendorId: "vendor-1",
    buyerId: "buyer-1",
    amount: 10,
    item: `Item ${id}`,
    status: "PENDING",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    history: [],
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

describe("useVendorEscrows request ordering", () => {
  beforeEach(() => {
    vi.mocked(getVendorEscrows).mockReset();
  });

  it("ignores obsolete success and failure responses after a retry", async () => {
    const obsolete = deferred<Escrow[]>();
    const active = deferred<Escrow[]>();
    vi.mocked(getVendorEscrows)
      .mockReturnValueOnce(obsolete.promise)
      .mockReturnValueOnce(active.promise);

    const { result } = renderHook(() =>
      useVendorEscrows({ errorMessage: "Unable to load escrows" })
    );
    await waitFor(() => expect(getVendorEscrows).toHaveBeenCalledTimes(1));

    act(() => result.current.retry());
    await waitFor(() => expect(getVendorEscrows).toHaveBeenCalledTimes(2));

    await act(async () => active.resolve([escrow("new") ]));
    expect(result.current.escrows?.[0].id).toBe("new");
    expect(result.current.error).toBeNull();

    await act(async () => obsolete.reject(new Error("stale failure")));
    expect(result.current.escrows?.[0].id).toBe("new");
    expect(result.current.error).toBeNull();
  });

  it("ignores a response after unmount", async () => {
    const pending = deferred<Escrow[]>();
    vi.mocked(getVendorEscrows).mockReturnValueOnce(pending.promise);

    const { unmount } = renderHook(() =>
      useVendorEscrows({ errorMessage: "Unable to load escrows" })
    );
    await waitFor(() => expect(getVendorEscrows).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => pending.resolve([escrow("late")]));
  });
});