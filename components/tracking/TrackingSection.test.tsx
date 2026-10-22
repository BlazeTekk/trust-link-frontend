import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTracking } from "@/hooks/useTracking";
import { ApiError } from "@/lib/api";
import type { Tracking } from "@/types";

import TrackingSection from "./TrackingSection";

vi.mock("@/hooks/useTracking", () => ({ useTracking: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

const tracking: Tracking = {
  escrowId: "escrow-a",
  status: "IN_TRANSIT",
  carrier: "Terminal Africa",
  trackingNumber: "TRACK-ABC",
  estimatedDelivery: "2026-10-24T12:00:00Z",
  events: [{
    id: "event-a",
    status: "PICKED_UP",
    description: "Collected from vendor",
    location: "Lagos",
    timestamp: "2026-10-22T12:00:00Z",
  }],
};
const refetch = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useTracking).mockReturnValue({
    data: null, status: null, estimatedDelivery: null,
    isLoading: false, error: null, refetch,
  });
});

describe("TrackingSection", () => {
  it("requests tracking for the routed escrow and handles an unshipped order", () => {
    render(<TrackingSection escrowId="escrow-a" />);
    expect(useTracking).toHaveBeenCalledWith("escrow-a");
    expect(screen.getByRole("status")).toHaveTextContent("tracking.noTracking");
    expect(screen.queryByText("tracking.outForDelivery")).not.toBeInTheDocument();
  });

  it("renders carrier details, ETA and only events from the feed", () => {
    vi.mocked(useTracking).mockReturnValue({
      data: tracking, status: tracking.status, estimatedDelivery: tracking.estimatedDelivery!,
      isLoading: false, error: null, refetch,
    });
    render(<TrackingSection escrowId="escrow-a" />);
    expect(screen.getByText("Terminal Africa")).toBeInTheDocument();
    expect(screen.getByText("TRACK-ABC")).toBeInTheDocument();
    expect(screen.getByText("IN_TRANSIT")).toBeInTheDocument();
    expect(screen.getByText("Collected from vendor")).toBeInTheDocument();
    expect(screen.getByText("Lagos")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("tracking.estimatedDelivery").nextElementSibling).toHaveTextContent("Oct 24, 2026");
  });

  it("offers retry when the feed fails", () => {
    vi.mocked(useTracking).mockReturnValue({
      data: null, status: null, estimatedDelivery: null,
      isLoading: false, error: new Error("network"), refetch,
    });
    render(<TrackingSection escrowId="escrow-a" />);
    expect(screen.getByRole("alert")).toHaveTextContent("tracking.carrierLoadError");
    fireEvent.click(screen.getByRole("button", { name: "tracking.retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("treats a missing shipment as unavailable tracking with a refresh action", () => {
    vi.mocked(useTracking).mockReturnValue({
      data: null, status: null, estimatedDelivery: null,
      isLoading: false, error: new ApiError(404, "No shipment"), refetch,
    });
    render(<TrackingSection escrowId="escrow-a" />);
    expect(screen.getByText("tracking.noTracking")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "tracking.retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows a loading skeleton while the initial request is pending", () => {
    vi.mocked(useTracking).mockReturnValue({
      data: null, status: null, estimatedDelivery: null,
      isLoading: true, error: null, refetch,
    });
    render(<TrackingSection escrowId="escrow-a" />);
    expect(screen.getByLabelText("Loading tracking status")).toBeInTheDocument();
    expect(screen.queryByText("tracking.noTracking")).not.toBeInTheDocument();
  });

  it("renders delivered payloads without inventing carrier events or an ETA", () => {
    vi.mocked(useTracking).mockReturnValue({
      data: { ...tracking, status: "delivered", events: [], estimatedDelivery: undefined },
      status: "delivered", estimatedDelivery: null,
      isLoading: false, error: null, refetch,
    });
    render(<TrackingSection escrowId="escrow-a" />);
    expect(screen.getByText("delivered")).toBeInTheDocument();
    expect(screen.getByText("tracking.noCarrierEvents")).toBeInTheDocument();
    expect(screen.queryByText("tracking.estimatedDelivery")).not.toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
