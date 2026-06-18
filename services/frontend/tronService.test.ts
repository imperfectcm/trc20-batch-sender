import type { TronLinkAdapter } from "@tronweb3/tronwallet-adapters";
import TronFrontendService from "./tronService";

declare function describe(name: string, fn: () => void): void;
declare function test(name: string, fn: () => void | Promise<void>): void;
declare function expect<T>(actual: T): {
  toBe(expected: T): void;
};

describe("TronFrontendService adapter mode", () => {
  test("uses the connected adapter passed by the wallet flow", () => {
    const address = "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";
    const adapter = {
      connected: true,
      address,
    } as TronLinkAdapter;

    const service = new TronFrontendService("adapter", {
      network: "mainnet",
      adapter,
    });

    expect(service.getAddress()).toBe(address);
  });
});
