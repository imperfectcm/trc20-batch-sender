export const ALLOWED_TOKENS = new Set(['TRX', 'USDT']);
export type TransferStatus = 'standby' | 'pending' | 'broadcasted' | 'confirmed' | 'failed' | 'timeout';

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
    status: TransferStatus;
    error?: string;
}

export type TransferItem = TransferReq & TransferRes & { status: TransferStatus };