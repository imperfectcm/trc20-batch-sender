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

function pollingService(query: (txid: string) => Promise<unknown>) {
  const service = new TronFrontendService("adapter", {
    network: "mainnet",
    adapter: { connected: true, address: "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj" } as TronLinkAdapter,
  });
  const trx = (service as unknown as { tronWeb: { trx: object } }).tronWeb.trx;
  Object.defineProperty(trx, "getTransactionInfo", { value: query });
  let waits = 0;
  Object.defineProperty(service, "timeslot", { get: () => { waits++; return 0; } });
  return { service, getWaits: () => waits };
}

describe("pollTx", () => {
  test("confirms USDT receipt and TRX block without sending a transaction", async () => {
    const usdt = pollingService(async () => ({ receipt: { result: "SUCCESS" } }));
    const trx = pollingService(async () => ({ blockNumber: 1 }));
    expect((await usdt.service.pollTx({ txid: "usdt", token: "USDT" })).status).toBe("confirmed");
    expect((await trx.service.pollTx({ txid: "trx", token: "TRX" })).status).toBe("confirmed");
    expect(usdt.getWaits()).toBe(0);
    expect(trx.getWaits()).toBe(0);
  });

  test("returns chain failures even when a TRX block exists", async () => {
    const reverted = pollingService(async () => ({ blockNumber: 1, receipt: { result: "REVERT" } }));
    const failed = pollingService(async () => ({ blockNumber: 1, result: "FAILED", resMessage: "out of energy" }));
    expect((await reverted.service.pollTx({ txid: "reverted", token: "TRX" })).status).toBe("failed");
    expect((await failed.service.pollTx({ txid: "failed", token: "TRX" })).status).toBe("failed");
    expect(reverted.getWaits()).toBe(0);
    expect(failed.getWaits()).toBe(0);
  });

  test("retries a query error and confirms the same transaction", async () => {
    let calls = 0;
    let active = 0;
    let maxActive = 0;
    const { service, getWaits } = pollingService(async txid => {
      expect(txid).toBe("same-txid");
      active++;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active--;
      if (++calls === 1) throw new Error("temporary RPC error");
      return { receipt: { result: "SUCCESS" } };
    });
    expect((await service.pollTx({ txid: "same-txid", token: "USDT", maxAttempts: 2 })).status).toBe("confirmed");
    expect(calls).toBe(2);
    expect(maxActive).toBe(1);
    expect(getWaits()).toBe(1);
  });

  test("keeps the result unknown when the final query fails", async () => {
    let calls = 0;
    const { service, getWaits } = pollingService(async () => {
      calls++;
      throw new Error("RPC unavailable");
    });
    const result = await service.pollTx({ txid: "same-txid", token: "USDT", maxAttempts: 3 });
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") expect(result.reason).toBe("RPC unavailable");
    expect(calls).toBe(3);
    expect(getWaits()).toBe(2);
  });

  test("times out after successful empty queries without a final wait", async () => {
    let calls = 0;
    const { service, getWaits } = pollingService(async () => { calls++; return {}; });
    expect((await service.pollTx({ txid: "same-txid", token: "USDT", maxAttempts: 3 })).status).toBe("timeout");
    expect(calls).toBe(3);
    expect(getWaits()).toBe(2);
  });
});
