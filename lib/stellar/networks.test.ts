import { Networks } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import {
  getNetworkPassphrase,
  isNetworkPassphrase,
  isValidNetworkPassphrase,
  resolveNetworkPassphrase,
} from "./networks";

const aliases = [
  ["PUBLIC", Networks.PUBLIC],
  ["MAINNET", Networks.PUBLIC],
  ["TESTNET", Networks.TESTNET],
  ["FUTURENET", Networks.FUTURENET],
  ["SANDBOX", Networks.SANDBOX],
  ["STANDALONE", Networks.STANDALONE],
] as const;

describe("network passphrase helpers", () => {
  it.each(aliases)("resolves %s regardless of case or surrounding whitespace", (alias, passphrase) => {
    for (const value of [alias, alias.toLowerCase(), alias[0] + alias.slice(1).toLowerCase(), `  ${alias}\t`]) {
      expect(resolveNetworkPassphrase(value)).toBe(passphrase);
      expect(isValidNetworkPassphrase(value)).toBe(true);
      expect(isNetworkPassphrase(value)).toBe(false);
    }
  });

  it.each(Object.values(Networks))("preserves the SDK passphrase %s", (passphrase) => {
    expect(resolveNetworkPassphrase(passphrase)).toBe(passphrase);
    expect(resolveNetworkPassphrase(`  ${passphrase}  `)).toBe(passphrase);
    expect(isValidNetworkPassphrase(passphrase)).toBe(true);
    expect(isNetworkPassphrase(passphrase)).toBe(true);
    // Detection is an exact SDK lookup, unlike resolution and validation.
    expect(isNetworkPassphrase(` ${passphrase} `)).toBe(false);
    expect(isNetworkPassphrase(passphrase.toLowerCase())).toBe(false);
  });

  it.each(["My Private Network ; July 2026", "custom-network"])("accepts the custom value %s without treating it as an SDK passphrase", (value) => {
    expect(resolveNetworkPassphrase(`  ${value}  `)).toBe(value);
    expect(isValidNetworkPassphrase(value)).toBe(true);
    expect(isNetworkPassphrase(value)).toBe(false);
  });

  it.each(["", " ", "\t\n"])("rejects blank input %j without throwing from detection helpers", (value) => {
    expect(() => resolveNetworkPassphrase(value)).toThrow("Network passphrase is required");
    expect(isValidNetworkPassphrase(value)).toBe(false);
    expect(isNetworkPassphrase(value)).toBe(false);
  });

  it.each([undefined, null, false, 42, {}])("rejects non-string input %j at runtime", (value) => {
    const input = value as unknown as string;
    expect(() => resolveNetworkPassphrase(input)).toThrow("Network passphrase is required");
    expect(isValidNetworkPassphrase(input)).toBe(false);
    expect(isNetworkPassphrase(input)).toBe(false);
  });

  it("returns the passphrases supported by contract helpers", () => {
    expect(getNetworkPassphrase("PUBLIC")).toBe(Networks.PUBLIC);
    expect(getNetworkPassphrase("TESTNET")).toBe(Networks.TESTNET);
  });
});
