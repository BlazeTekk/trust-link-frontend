import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RouteGroupErrorBoundary from "./error";

describe("Payment route error feedback", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("shows safe retryable feedback without classifying the order as missing", () => {
    render(<RouteGroupErrorBoundary error={new Error("private API configuration")} reset={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load payment");
    expect(screen.getByText(/We couldn’t load the escrow details/)).toBeInTheDocument();
    expect(screen.queryByText("Escrow Not Found")).not.toBeInTheDocument();
    expect(screen.queryByText("private API configuration")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("uses the Next.js retry callback to refetch the server segment", () => {
    const reset = vi.fn();
    const retry = vi.fn();
    render(<RouteGroupErrorBoundary error={new Error("Service unavailable")} reset={reset} unstable_retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(reset).not.toHaveBeenCalled();
  });

  it("preserves the reset callback for callers using the existing contract", () => {
    const reset = vi.fn();
    render(<RouteGroupErrorBoundary error={new Error("Offline")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
