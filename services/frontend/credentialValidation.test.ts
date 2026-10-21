import { TronWeb } from "tronweb";
import {
  deriveCredentialAccount,
  validateCredentialForAddress,
} from "./credentialValidation";

declare function describe(name: string, fn: () => void): void;
declare function test(name: string, fn: () => void | Promise<void>): void;
declare function expect<T>(actual: T): {
  toBe(expected: T): void;
};

const privateKey =
  "0000000000000000000000000000000000000000000000000000000000000001";
const privateKeyAddress = TronWeb.address.fromPrivateKey(privateKey);
if (!privateKeyAddress) {
  throw new Error("Test private key must derive a TRON address");
}

describe("credentialValidation", () => {
  test("derives the address from a private key without sending it to the server", () => {
    const account = deriveCredentialAccount(privateKey);

    expect(account.address).toBe(privateKeyAddress);
    expect(account.privateKey).toBe(privateKey);
  });

  test("accepts 0x-prefixed private keys but returns a signable canonical key", () => {
    const account = deriveCredentialAccount(`0x${privateKey}`);

    expect(account.address).toBe(privateKeyAddress);
    expect(account.privateKey).toBe(privateKey);
  });

  test("derives and canonicalizes a mnemonic account for later signing", () => {
    const mnemonic =
      "test test test test test test test test test test test junk";
    const expectedAccount = TronWeb.fromMnemonic(mnemonic);
    const account = deriveCredentialAccount(
      `  ${mnemonic.replaceAll(" ", "   ")}  `,
    );

    expect(account.address).toBe(expectedAccount.address);
    expect(account.privateKey).toBe(
      expectedAccount.privateKey.replace(/^0x/, ""),
    );
    expect(TronWeb.address.fromPrivateKey(account.privateKey)).toBe(
      expectedAccount.address,
    );
  });

  test("validates a credential against an activated sender address", () => {
    expect(validateCredentialForAddress(privateKeyAddress, privateKey)).toBe(
      true,
    );
    expect(
      validateCredentialForAddress(
        "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
        privateKey,
      ),
    ).toBe(false);
  });
});
