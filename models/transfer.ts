export const ALLOWED_TOKENS = new Set(['TRX', 'USDT']);
type TransferStatus = 'standby' | 'pending' | 'broadcasted' | 'confirmed' | 'failed' | '';

export type TransferReq = {
    network: string;
    privateKey: string;
    fromAddress: string;
    toAddress: string;
    token: string;
    amount: number;
}

export type TransferRes = {
    txID?: string;
    status: TransferStatus;
}