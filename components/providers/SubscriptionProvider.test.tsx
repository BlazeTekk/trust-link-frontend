import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProGate from "@/components/subscription/ProGate";
import UpgradeCTA from "@/components/subscription/UpgradeCTA";
import { getSubscription } from "@/lib/api";
import type { Plan, Subscription } from "@/types";

import { clearSubscriptionCache, SubscriptionProvider, useSubscription } from "./SubscriptionProvider";

vi.mock("@/lib/api", () => ({ getSubscription: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const now = Date.UTC(2026, 9, 22, 12);
const ttl = 5 * 60 * 1000;
const free: Subscription = { plan: "FREE", vendorId: "vendor-one" };
const pro: Subscription = {
  plan: "PRO",
  vendorId: "vendor-one",
  upgradedAt: "2026-10-22T12:00:00Z",
};

function SubscriptionConsumer() {
  const { plan, subscription, isPro, isLoading, refetch } = useSubscription();
  return (
    <>
      <output data-testid="subscription-state">{JSON.stringify({ plan, subscription, isPro, isLoading })}</output>
      <button onClick={() => void refetch()}>Refresh subscription</button>
      <ProGate feature="Analytics"><p>Premium analytics</p></ProGate>
      <UpgradeCTA />
    </>
  );
}

function renderConsumer() {
  return render(<SubscriptionProvider><SubscriptionConsumer /></SubscriptionProvider>);
}

function cache(plan: Plan, ts: number) {
  localStorage.setItem("subscription.cache", JSON.stringify({ plan, ts }));
}

function expectState(plan: Plan, subscription: Subscription | null, isLoading = false) {
  expect(JSON.parse(screen.getByTestId("subscription-state").textContent!)).toEqual({
    plan, subscription, isPro: plan === "PRO", isLoading,
  });
}

function expectFreeGate() {
  expect(screen.queryByRole("status", { name: "Loading Analytics" })).not.toBeInTheDocument();
  expect(screen.queryByText("Premium analytics")).not.toBeInTheDocument();
  expect(screen.getByText("Analytics is a Pro feature")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Upgrade to Pro" })).toHaveAttribute("href", "/pricing");
  expect(screen.getByRole("alert")).toHaveTextContent("dashboard.upgradeCtaTitle");
  expect(screen.getByRole("link", { name: "dashboard.upgradeCtaButton" })).toHaveAttribute("href", "/pricing");
}

function expectProContent() {
  expect(screen.getByText("Premium analytics")).toBeInTheDocument();
  expect(screen.queryByText("Analytics is a Pro feature")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("status", { name: "Loading Analytics" })).not.toBeInTheDocument();
}

describe("SubscriptionProvider caching and consumers", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("wallet.jwt", "vendor-token");
    vi.mocked(getSubscription).mockReset();
    // Fix cache age without replacing timers used by React or waitFor.
    vi.spyOn(Date, "now").mockReturnValue(now);
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it.each(["FREE", "PRO"] as const)("uses a fresh %s cache without fetching", async (plan) => {
    cache(plan, now - ttl + 1);
    renderConsumer();
    await waitFor(() => expectState(plan, null));
    expect(getSubscription).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("subscription.cache")!)).toEqual({ plan, ts: now - ttl + 1 });
    if (plan === "PRO") expectProContent();
    else expectFreeGate();
  });

  it("accepts a cache exactly at the TTL boundary", async () => {
    cache("PRO", now - ttl);
    renderConsumer();
    await waitFor(() => expectState("PRO", null));
    expect(getSubscription).not.toHaveBeenCalled();
  });

  it("expires the cache after the TTL and replaces it with fresh subscription data", async () => {
    cache("PRO", now - ttl - 1);
    vi.mocked(getSubscription).mockResolvedValue(free);
    const remove = vi.spyOn(localStorage, "removeItem");
    renderConsumer();
    await waitFor(() => expectState("FREE", free));
    expect(remove).toHaveBeenCalledWith("subscription.cache");
    expect(getSubscription).toHaveBeenCalledExactlyOnceWith("vendor-token");
    expect(JSON.parse(localStorage.getItem("subscription.cache")!)).toEqual({ plan: "FREE", ts: now });
    expectFreeGate();
  });

  it("shows loading gates until PRO is confirmed by the server", async () => {
    let resolve!: (value: Subscription) => void;
    vi.mocked(getSubscription).mockReturnValue(new Promise<Subscription>((done) => { resolve = done; }));
    renderConsumer();
    expectState("FREE", null, true);
    expect(screen.getByRole("status", { name: "Loading Analytics" })).toBeInTheDocument();
    expect(screen.queryByText("Premium analytics")).not.toBeInTheDocument();
    expect(screen.queryByText("Analytics is a Pro feature")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(async () => { resolve(pro); });
    expectState("PRO", pro);
    expectProContent();
    expect(getSubscription).toHaveBeenCalledExactlyOnceWith("vendor-token");
    expect(JSON.parse(localStorage.getItem("subscription.cache")!)).toEqual({ plan: "PRO", ts: now });
  });

  it("bypasses a fresh FREE cache on refetch and unlocks PRO without remounting", async () => {
    cache("FREE", now);
    vi.mocked(getSubscription).mockResolvedValue(pro);
    renderConsumer();
    await waitFor(() => expectState("FREE", null));
    expectFreeGate();
    expect(getSubscription).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh subscription" }));
    await waitFor(() => expectState("PRO", pro));
    expect(getSubscription).toHaveBeenCalledExactlyOnceWith("vendor-token");
    expectProContent();
    expect(JSON.parse(localStorage.getItem("subscription.cache")!)).toEqual({ plan: "PRO", ts: now });
  });

  it("fetches again on each explicit refetch, including a change back to FREE", async () => {
    vi.mocked(getSubscription).mockResolvedValueOnce(pro).mockResolvedValueOnce(free);
    renderConsumer();
    await waitFor(() => expectState("PRO", pro));
    expectProContent();
    fireEvent.click(screen.getByRole("button", { name: "Refresh subscription" }));
    await waitFor(() => expectState("FREE", free));
    expect(getSubscription).toHaveBeenCalledTimes(2);
    expectFreeGate();
    expect(JSON.parse(localStorage.getItem("subscription.cache")!)).toEqual({ plan: "FREE", ts: now });
  });

  it("settles to FREE when no wallet token exists, even with a cached PRO plan", async () => {
    localStorage.removeItem("wallet.jwt");
    cache("PRO", now);
    renderConsumer();
    await waitFor(() => expectState("FREE", null));
    expect(getSubscription).not.toHaveBeenCalled();
    expectFreeGate();
  });

  it("settles to FREE when the subscription request fails", async () => {
    vi.mocked(getSubscription).mockRejectedValue(new Error("No subscription record"));
    renderConsumer();
    await waitFor(() => expectState("FREE", null));
    expect(getSubscription).toHaveBeenCalledExactlyOnceWith("vendor-token");
    expectFreeGate();
  });

  it("clears only the subscription cache", () => {
    cache("PRO", now);
    clearSubscriptionCache();
    expect(localStorage.getItem("subscription.cache")).toBeNull();
    expect(localStorage.getItem("wallet.jwt")).toBe("vendor-token");
  });
});
