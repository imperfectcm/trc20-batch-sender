import { TronWeb } from "tronweb";

export type Account = Awaited<ReturnType<typeof TronWeb.prototype.trx.getAccount>>;
export type AccountResource = Awaited<ReturnType<typeof TronWeb.prototype.trx.getAccountResources>>;

export interface TronGridTokenInfo {
    symbol: string;
    address: string;
    decimals: number;
    name: string;
}

export interface TronGridTrc20Transaction {
    transaction_id: string;
    token_info: TronGridTokenInfo;
    block_timestamp: number;
    from: string;
    to: string;
    type: string;
    value: string;
}

export interface TronGridTrc20Response {
    data: TronGridTrc20Transaction[];
    success?: boolean;
    meta?: {
        at: number;
        page_size: number;
    };
}