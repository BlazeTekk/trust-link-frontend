import { Networks } from "@stellar/stellar-sdk";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Load after stubbing the RPC URL: network configs are created at module scope.
let NetworkProvider: typeof import("./NetworkProvider").NetworkProvider;
let useNetwork: typeof import("./NetworkProvider").useNetwork;
const rpcUrl = "https://rpc.example.test/testnet";

function NetworkConsumer() {
  const { network, isTestnet, isMainnet, config, setNetwork, toggleNetwork } = useNetwork();
  return (
    <>
      <output data-testid="network-state">{JSON.stringify({ network, isTestnet, isMainnet, config })}</output>
      <button onClick={() => setNetwork("testnet")}>Set testnet</button>
      <button onClick={() => setNetwork("mainnet")}>Set mainnet</button>
      <button onClick={toggleNetwork}>Toggle network</button>
    </>
  );
}

function renderConsumer() {
  return render(<NetworkProvider><NetworkConsumer /></NetworkProvider>);
}

function expectNetwork(network: "testnet" | "mainnet") {
  expect(JSON.parse(screen.getByTestId("network-state").textContent!)).toEqual({
    network,
    isTestnet: network === "testnet",
    isMainnet: network === "mainnet",
    config: network === "testnet" ? {
      rpcUrl,
      networkPassphrase: Networks.TESTNET,
      horizonUrl: "https://horizon-testnet.stellar.org",
      stellarExpertPrefix: "testnet",
    } : {
      rpcUrl: "https://soroban.stellar.org",
      networkPassphrase: Networks.PUBLIC,
      horizonUrl: "https://horizon.stellar.org",
      stellarExpertPrefix: "public",
    },
  });
}

describe("NetworkProvider", () => {
  beforeAll(async () => {
    vi.stubEnv("NEXT_PUBLIC_SOROBAN_RPC_URL", rpcUrl);
    ({ NetworkProvider, useNetwork } = await import("./NetworkProvider"));
  });
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", undefined);
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });
  afterAll(() => vi.unstubAllEnvs());

  it.each([
    [undefined, "testnet"],
    ["testnet", "testnet"],
    ["mainnet", "mainnet"],
    ["public", "mainnet"],
    ["unknown", "testnet"],
    ["MAINNET", "testnet"],
  ] as const)("resolves environment %s to %s when no preference exists", (env, network) => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", env);
    renderConsumer();
    expectNetwork(network);
    expect(localStorage.getItem("network.preferred")).toBeNull();
  });

  it.each([
    ["testnet", "mainnet"],
    ["mainnet", "testnet"],
  ] as const)("prefers stored %s over environment %s", (stored, env) => {
    localStorage.setItem("network.preferred", stored);
    vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", env);
    renderConsumer();
    expectNetwork(stored);
  });

  it.each(["", "public", "MAINNET", "invalid"])("ignores unsupported stored preference %j", (stored) => {
    localStorage.setItem("network.preferred", stored);
    vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", "public");
    renderConsumer();
    expectNetwork("mainnet");
  });

  it("sets either network, updates the entire config, and restores the persisted selection", () => {
    const { unmount } = renderConsumer();
    for (const network of ["mainnet", "testnet", "mainnet"] as const) {
      fireEvent.click(screen.getByRole("button", { name: `Set ${network}` }));
      expectNetwork(network);
      expect(localStorage.getItem("network.preferred")).toBe(network);
    }
    unmount();
    renderConsumer();
    expectNetwork("mainnet");
  });

  it("toggles in both directions and persists each selection", () => {
    renderConsumer();
    expectNetwork("testnet");
    for (const network of ["mainnet", "testnet"] as const) {
      fireEvent.click(screen.getByRole("button", { name: "Toggle network" }));
      expectNetwork(network);
      expect(localStorage.getItem("network.preferred")).toBe(network);
    }
  });
});
