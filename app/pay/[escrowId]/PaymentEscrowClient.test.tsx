import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { patchBuyerContact } from "@/lib/api";
import i18n from "@/lib/i18n";
import { connectFreighter, isFreighterInstalled } from "@/lib/stellar/freighter";
import type { Escrow } from "@/types";
import { EscrowStatusConst } from "@/types";

import { PaymentEscrowClient } from "./PaymentEscrowClient";

const { connect } = vi.hoisted(() => ({ connect: vi.fn().mockResolvedValue(true) }));

vi.mock("@/hooks/useWallet", () => ({
  default: () => ({ connect, isLoading: false }),
}));

vi.mock("@/components/providers/NetworkProvider", () => ({
  useNetwork: () => ({ network: "testnet", isTestnet: true, isMainnet: false, toggleNetwork: vi.fn(), setNetwork: vi.fn() }),
  NetworkProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/api", () => ({
  patchBuyerContact: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/stellar/freighter", () => ({
  connectFreighter: vi.fn(),
  isFreighterInstalled: vi.fn().mockResolvedValue(true),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const baseEscrow: Escrow = {
  id: "escrow-1",
  vendorId: "GVENDORADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  amount: 100,
  item: "Vintage Camera",
  status: EscrowStatusConst.PENDING,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  history: [],
};

describe("PaymentEscrowClient i18n", () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  it("renders English copy by default", () => {
    render(<PaymentEscrowClient escrow={baseEscrow} escrowId="escrow-1" />);

    expect(screen.getByText("Complete Payment")).toBeInTheDocument();
    expect(screen.getByText("Pay Now")).toBeInTheDocument();
    expect(screen.getByText("Order Details")).toBeInTheDocument();
  });

  it("switches to French without remounting when the active language changes", async () => {
    render(<PaymentEscrowClient escrow={baseEscrow} escrowId="escrow-1" />);
    expect(screen.getByText("Complete Payment")).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage("fr");
    });

    expect(screen.getByText("Finaliser le paiement")).toBeInTheDocument();
    expect(screen.getByText("Payer maintenant")).toBeInTheDocument();
    expect(screen.getByText("Détails de la commande")).toBeInTheDocument();
    expect(screen.queryByText("Complete Payment")).not.toBeInTheDocument();
  });
});


describe("PaymentEscrowClient payment eligibility", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const guidance = {
    PENDING: null,
    FUNDED: "payment.alreadyFunded",
    SHIPPED: "payment.alreadyShipped",
    COMPLETED: "payment.alreadyCompleted",
    RELEASED: "payment.alreadyReleased",
    REFUNDED: "payment.alreadyRefunded",
    DISPUTED: "payment.alreadyDisputed",
    EXPIRED: "payment.expiredMessage",
  };

  it.each(Object.values(EscrowStatusConst))(
    "only enables payment for pending escrows: %s",
    async (status) => {
      render(
        <PaymentEscrowClient
          escrow={{ ...baseEscrow, status, expiresAt: new Date(Date.now() + 60_000).toISOString() }}
          escrowId={baseEscrow.id}
        />
      );
      const button = screen.getByRole("button", { name: "Pay Now" });
      if (status === EscrowStatusConst.PENDING) {
        expect(button).toBeEnabled();
        fireEvent.change(screen.getByLabelText(/Email address/), {
          target: { value: "buyer@example.com" },
        });
        await act(async () => { fireEvent.click(button); });
        expect(patchBuyerContact).toHaveBeenCalledOnce();
        expect(isFreighterInstalled).toHaveBeenCalledOnce();
        expect(connectFreighter).toHaveBeenCalledOnce();
      } else {
        expect(button).toBeDisabled();
        expect(screen.getByText(i18n.t(guidance[status]!))).toBeInTheDocument();
        expect(screen.queryByLabelText(/Email address/)).not.toBeInTheDocument();
        if (status !== EscrowStatusConst.EXPIRED) {
          expect(screen.queryByTestId("escrow-countdown")).not.toBeInTheDocument();
        }

        // Invoke React's registered handler directly to verify its guard even
        // when an invocation bypasses the browser's disabled-button protection.
        const propsKey = Object.keys(button).find((key) => key.startsWith("__reactProps$"));
        expect(propsKey).toBeDefined();
        const props = (button as unknown as Record<string, { onClick: () => Promise<void> }>)[propsKey!];
        await act(async () => { await props.onClick(); });
        expect(patchBuyerContact).not.toHaveBeenCalled();
        expect(isFreighterInstalled).not.toHaveBeenCalled();
        expect(connectFreighter).not.toHaveBeenCalled();
        expect(connect).not.toHaveBeenCalled();
      }
    }
  );

  it("disables payment when a pending escrow expires while open", () => {
    vi.useFakeTimers();
    render(
      <PaymentEscrowClient
        escrow={{ ...baseEscrow, expiresAt: new Date(Date.now() + 1_000).toISOString() }}
        escrowId={baseEscrow.id}
      />
    );
    expect(screen.getByRole("button", { name: "Pay Now" })).toBeEnabled();
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByRole("button", { name: "Pay Now" })).toBeDisabled();
    expect(screen.getByText(i18n.t("payment.expiredMessage"))).toBeInTheDocument();
    expect(patchBuyerContact).not.toHaveBeenCalled();
    expect(isFreighterInstalled).not.toHaveBeenCalled();
    expect(connectFreighter).not.toHaveBeenCalled();
        expect(connect).not.toHaveBeenCalled();
  });

  it("blocks an expired deadline before the next countdown tick", async () => {
    vi.useFakeTimers();
    const now = Date.now();
    render(
      <PaymentEscrowClient
        escrow={{ ...baseEscrow, expiresAt: new Date(now + 500).toISOString() }}
        escrowId={baseEscrow.id}
      />
    );
    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: "buyer@example.com" },
    });
    vi.setSystemTime(now + 500);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pay Now" }));
    });
    expect(screen.getByRole("button", { name: "Pay Now" })).toBeDisabled();
    expect(patchBuyerContact).not.toHaveBeenCalled();
    expect(isFreighterInstalled).not.toHaveBeenCalled();
    expect(connectFreighter).not.toHaveBeenCalled();
        expect(connect).not.toHaveBeenCalled();
  });

  it("blocks an escrow whose deadline has already passed on load", () => {
    render(
      <PaymentEscrowClient
        escrow={{ ...baseEscrow, expiresAt: new Date(Date.now() - 1_000).toISOString() }}
        escrowId={baseEscrow.id}
      />
    );
    expect(screen.getByRole("button", { name: "Pay Now" })).toBeDisabled();
    expect(screen.getByText(i18n.t("payment.expiredMessage"))).toBeInTheDocument();
  });
});
