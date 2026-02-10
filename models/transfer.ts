export const ALLOWED_TOKENS = new Set(['TRX', 'USDT']);
export const RENTAL_PACKAGES = [
    { energy: 131000, price: 5.50, id: 'premium' },
    { energy: 65000, price: 3.00, id: 'standard' }
] as const;

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

export type SingleTransferData = TransferReq & TransferRes;
export type BatchTransferData = Omit<SingleTransferData, 'toAddress' | 'amount'>
    & {
        data: {
            toAddress: string;
            amount: number;
            warning?: string;
        }[];
    };

export type TransferItem = TransferReq & TransferRes & { status: TransferStatus };