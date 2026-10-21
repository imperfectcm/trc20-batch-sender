import { TronWeb } from "tronweb";

export type DerivedCredentialAccount = {
  address: string;
  privateKey: string;
};

function normalizeMnemonic(value: string): string {
  return value.trim().split(/\s+/).join(" ");
}

function normalizePrivateKey(value: string): string {
  return value.trim().replace(/^0x/i, "");
}

export function deriveCredentialAccount(
  credential: string,
): DerivedCredentialAccount {
  const trimmed = credential.trim();
  if (!trimmed) {
    throw new Error("No private key provided");
  }

  if (/\s/.test(trimmed)) {
    try {
      const account = TronWeb.fromMnemonic(normalizeMnemonic(trimmed));
      if (!account.address || !account.privateKey) {
        throw new Error("Invalid mnemonic phrase");
      }

      return {
        address: account.address,
        privateKey: normalizePrivateKey(account.privateKey),
      };
    } catch {
      throw new Error("Invalid mnemonic phrase");
    }
  }

  const privateKey = normalizePrivateKey(trimmed);
  if (privateKey.length !== 64) {
    throw new Error("Invalid private key length");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("Private key contains invalid characters");
  }

  const address = TronWeb.address.fromPrivateKey(privateKey);
  if (!address) {
    throw new Error("Invalid private key");
  }

  return { address, privateKey };
}

export function validateCredentialForAddress(
  address: string,
  credential: string,
): boolean {
  if (!address) {
    throw new Error("No address provided");
  }

  return deriveCredentialAccount(credential).address === address;
}
