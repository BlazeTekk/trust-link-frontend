import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { cancelEscrow, getVendorEscrows } from "@/lib/api";

import VendorDashboardList from "../VendorDashboardList";

// Mock external dependencies
vi.mock("@/lib/api", () => ({
  getVendorEscrows: vi.fn(),
  cancelEscrow: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("@/components/providers/CurrencyProvider", () => ({
  useCurrency: () => ({
    formatAmount: (amount: number) => `$${amount}`,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../EmptyVendorState", () => ({
  default: () => <div data-testid="empty-state">dashboard.noEscrowsFound</div>,
}));

describe("VendorDashboardList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getVendorEscrows as import("vitest").Mock).mockResolvedValue([]);
  });

  it("keeps the list and confirmation available after cancellation failure", async () => {
    (getVendorEscrows as import("vitest").Mock).mockResolvedValue([
      {
        id: "cancel-1",
        vendorId: "vendor-1",
        buyerId: "buyer-1",
        amount: 100,
        item: "Retryable Item",
        status: "PENDING",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [],
      },
      {
        id: "keep-1",
        vendorId: "vendor-1",
        buyerId: "buyer-1",
        amount: 50,
        item: "Unaffected Item",
        status: "PENDING",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [],
      },
    ]);
    vi.mocked(cancelEscrow)
      .mockRejectedValueOnce(new Error("Cancellation failed"))
      .mockResolvedValueOnce({} as never);

    render(<VendorDashboardList />);
    await screen.findByText("Retryable Item");

    fireEvent.click(screen.getAllByRole("button", { name: "dashboard.cancel" })[0]);
    const confirm = await screen.findByRole("button", {
      name: "dashboard.cancelEscrowTitle",
    });
    fireEvent.click(confirm);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByText("Retryable Item")).toBeInTheDocument();
    expect(screen.getByText("Unaffected Item")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("dashboard.searchPlaceholder")).toBeInTheDocument();
    expect(screen.queryByText("dashboard.loadEscrowsTitle")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "dashboard.cancelEscrowTitle" }));
    await waitFor(() => expect(screen.queryByText("Retryable Item")).not.toBeInTheDocument());
    expect(screen.getByText("Unaffected Item")).toBeInTheDocument();
  });

  it("renders empty state when no escrows are returned", async () => {
    render(<VendorDashboardList />);
    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
  });

  it("renders escrows and handles search filtering", async () => {
    const mockEscrows = [
      { id: "1", item: "Laptop", amount: 1000, status: "PENDING", createdAt: new Date().toISOString() },
      { id: "2", item: "Phone", amount: 500, status: "COMPLETED", createdAt: new Date().toISOString() },
    ];
    (getVendorEscrows as import("vitest").Mock).mockResolvedValue(mockEscrows);

    render(<VendorDashboardList />);
    
    // Wait for the escrows to load
    await waitFor(() => {
      expect(screen.getByText("Laptop")).toBeInTheDocument();
      expect(screen.getByText("Phone")).toBeInTheDocument();
    });

    // Test search filter
    const searchInput = screen.getByPlaceholderText("dashboard.searchPlaceholder");
    fireEvent.change(searchInput, { target: { value: "Laptop" } });

    await waitFor(() => {
      expect(screen.getByText("Laptop")).toBeInTheDocument();
      expect(screen.queryByText("Phone")).not.toBeInTheDocument();
    });
  });
  
  it("shows error state when fetching fails", async () => {
    (getVendorEscrows as import("vitest").Mock).mockRejectedValue(new Error("Fetch failed"));
    render(<VendorDashboardList />);
    
    await waitFor(() => {
      expect(screen.getByText("dashboard.loadEscrowsTitle")).toBeInTheDocument();
    });
  });
});
