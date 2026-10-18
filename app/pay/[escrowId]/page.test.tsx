import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiConfigurationError, ApiError, ApiNetworkError } from "@/lib/api";
import type { Escrow } from "@/types";

import PayPage from "./page";

vi.mock("./PaymentEscrowClient", () => ({
  PaymentEscrowClient: ({ escrow }: { escrow: Escrow }) => <div>{escrow.item}</div>,
}));
vi.mock("@/components/payment/HowItWorks", () => ({ HowItWorks: () => null }));
vi.mock("@/components/ui/Accordion", () => ({ Accordion: () => null }));

const escrow: Escrow = {
  id: "escrow-1",
  vendorId: "vendor-1",
  item: "Vintage Camera",
  amount: 100,
  status: "PENDING",
  createdAt: "2026-10-18T00:00:00Z",
  updatedAt: "2026-10-18T00:00:00Z",
  history: [],
};
const params = Promise.resolve({ escrowId: escrow.id });
const apiUrl = "http://localhost:3000/api";
const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("PayPage escrow lookup", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_API_URL", apiUrl);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("renders a found escrow", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(escrow));
    render(await PayPage({ params }));
    expect(screen.getByText(escrow.item)).toBeInTheDocument();
    expect(screen.queryByText("Escrow Not Found")).not.toBeInTheDocument();
  });

  it("renders missing only after both lookup endpoints return 404", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 404)).mockResolvedValueOnce(jsonResponse({}, 404));
    render(await PayPage({ params }));
    expect(screen.getByRole("heading", { name: "Escrow Not Found" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${apiUrl}/escrow/${escrow.id}`, `${apiUrl}/escrows/${escrow.id}`,
    ]);
  });

  it("preserves a successful plural fallback after a singular 404", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 404)).mockResolvedValueOnce(jsonResponse(escrow));
    render(await PayPage({ params }));
    expect(screen.getByText(escrow.item)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([500, 502, 503])("propagates HTTP %s to the retryable route boundary", async (status) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Service unavailable" }, status));
    await expect(PayPage({ params })).rejects.toMatchObject({ status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates a network outage to the retryable route boundary", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(PayPage({ params })).rejects.toBeInstanceOf(ApiNetworkError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not represent a configuration failure as a missing escrow", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    await expect(PayPage({ params })).rejects.toBeInstanceOf(ApiConfigurationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    () => jsonResponse({ id: escrow.id }),
    () => new Response("not-json", { status: 200 }),
    () => new Response("", { status: 200 }),
  ])("propagates invalid API payloads", async (response) => {
    fetchMock.mockResolvedValueOnce(response());
    await expect(PayPage({ params })).rejects.toThrow(/Invalid API response/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates server errors from the plural fallback", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 404)).mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(PayPage({ params })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propagates network failures from the plural fallback", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 404)).mockRejectedValueOnce(new TypeError("Offline"));
    await expect(PayPage({ params })).rejects.toBeInstanceOf(ApiNetworkError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propagates invalid payloads from the plural fallback", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 404)).mockResolvedValueOnce(jsonResponse({}));
    await expect(PayPage({ params })).rejects.toThrow(/Invalid API response/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
