import { Network } from "./network";

export const ALLOWED_TOKENS = new Set(['TRX', 'USDT']);
export const ADDRESS_MAP: Record<string, Record<Network, string>> = {
    "USDT": {
        mainnet: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        shasta: "TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs"
    },
    "BATCH_SENDER_CONTRACT": {
        mainnet: "TVHa5pgvGtSgtbyKLxgQvM3CWKVpgxHHat",
        shasta: "TEzF63sbFzgSkg8nCZcXKWu6UvzziVoPzx"
    }
}
export const TRONZAP_ADDRESS = "TQssuzjvQbqtmEjmd9sGHuBQMdpvrCov3h";
export const RENTAL_PACKAGES = [
    { energy: 131000, price: 5.50, id: 'premium' },
    { energy: 65000, price: 3.00, id: 'standard' }
] as const;

export type ProcessStage = '' | 'idle' | 'approving' | 'estimating-energy' | 'renting-energy' | 'broadcasting' | 'confirming' | 'confirmed' | 'failed' | 'timeout' | 'energy-timeout';

export type TransferReq = {
    network: string;
    privateKey: string;
    fromAddress: string;
    toAddress: string;
    token: string;
    amount: number;
}

export type TransferRes = {
    txid?: string;
    error?: string;
}

export type SingleTransferData = TransferReq & TransferRes;
export type BatchTransferData = Omit<SingleTransferData, 'toAddress' | 'amount'>
    & {
        data: {
            toAddress: string;
            amount: number;
            warning?: string;
        }[];
    };

export type TransferItem = TransferReq & TransferRes;