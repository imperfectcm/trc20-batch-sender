// frontend/services/tronFrontendService.ts

import { API_ENDPOINTS, Network } from "@/models/network";
import { api } from "@/utils/api";
import { SignedTransaction, Transaction } from "@tronweb3/tronwallet-abstract-adapter";
import { TronLinkAdapter } from "@tronweb3/tronwallet-adapters";
import { BigNumber, TronWeb } from "tronweb";

class TronFrontendService {
    private tronWeb: TronWeb;
    private adapter?: TronLinkAdapter;
    private privateKey?: string;

    private timeslot: number = 5000; // 5 seconds

    private static API_ENDPOINTS = API_ENDPOINTS;

    constructor(mode: 'adapter' | 'privateKey', config: { network: Network, privateKey?: string }) {
        this.tronWeb = new TronWeb({
            fullHost: TronFrontendService.API_ENDPOINTS[config.network],
        });

        if (mode === 'adapter') {
            this.adapter = new TronLinkAdapter();
        } else if (mode === 'privateKey' && config.privateKey) {
            this.privateKey = config.privateKey;
            this.tronWeb.setPrivateKey(config.privateKey);
        }
    }

    // Get current address
    getAddress(): string {
        if (this.adapter) {
            if (!this.adapter.connected) {
                throw new Error("Adapter not connected. Call connect() first.");
            }
            return this.adapter.address!;
        } else {
            return this.tronWeb.defaultAddress.base58 + "";
        }
    }

    // Sign transfer contract
    async sign(unsignedTx: Transaction): Promise<SignedTransaction> {
        try {
            if (this.adapter) {
                if (!this.adapter.connected) {
                    await this.adapter.connect();
                }
                const signedTx = await this.adapter.signTransaction(unsignedTx);
                return signedTx;
            } else if (this.privateKey) {
                const signedTx = await this.tronWeb.trx.sign(unsignedTx);

                return signedTx;
            } else {
                throw new Error("No signing method available");
            }
        } catch (error) {
            console.error("Error signing transaction:", error);
            throw error;
        }
    }

    // Broadcast transaction
    async broadcast(signedTx: any): Promise<{ txid: string }> {
        const result = await this.tronWeb.trx.sendRawTransaction(signedTx);
        if (result.code) {
            throw new Error(`Broadcast failed: ${result.code}`);
        }
        return { txid: result.txid };
    }

    // Check transaction confirmation status
    async pollTx(txid: string, maxAttempts = 24): Promise<boolean> {
        for (let i = 0; i < maxAttempts; i++) {
            const info = await this.tronWeb.trx.getTransactionInfo(txid);
            if (info && info.receipt?.result) {
                if (info.receipt.result === 'SUCCESS') {
                    return true;
                } else {
                    throw new Error(`Transaction reverted: ${info.receipt.result}`);
                }
            }
            await new Promise(res => setTimeout(res, this.timeslot));
        }
        return false;
    }

    async rentEnergy(payload: {
        network: Network,
        address: string,
        energyReq: number,
    }): Promise<{ txid: string, skip: boolean }> {
        // 1. Build energy rental unsigned transaction in backend
        const result = await api<{ success: boolean, data?: { unsignedTx: Transaction }, message?: string, skip?: boolean }>('/api/energy/rental', { ...payload });
        if (!result.success || !result.data) {
            throw new Error(result.message || "Energy rental failed");
        }
        const skip = result.skip || false;
        if (skip) {
            return { txid: "", skip }; // Indicate that rental was skipped (e.g., already has enough energy)
        }
        const unsignedTx = result.data.unsignedTx;

        // 2. Sign transaction
        const signedTx = await this.sign(unsignedTx);

        // 3. Broadcast batch transaction
        const { txid } = await this.broadcast(signedTx);
        return { txid, skip };
    }

    // Single transfer (complete process)
    async singleTransfer(payload: {
        network: Network,
        toAddress: string,
        token: string,
        amount: number
    }): Promise<{ txid: string }> {
        const fromAddress = this.getAddress();
        // 1. Build unsigned transaction in backend
        const { unsignedTx } = await api<{ unsignedTx: Transaction }>(
            '/api/transfer/single',
            { fromAddress, ...payload }
        )
        if (!unsignedTx) throw new Error("Failed to get unsigned transaction");

        // 2. Sign transaction
        const signedTx = await this.sign(unsignedTx);

        // 3. Broadcast transaction
        const { txid } = await this.broadcast(signedTx);
        return { txid };
    }

    async approveBatchTransfer(payload: {
        network: Network,
        token: string,
        recipients: { toAddress: string, amount: number }[]
    }): Promise<{ sufficient: boolean, txid?: string, totalAmount: string }> { // Return txid if approval is needed
        const { network, token, recipients } = payload;
        const fromAddress = this.getAddress();

        // 1. Check allowance
        const { allowance } = await api<{ allowance: string }>(
            '/api/transfer/allowance',
            { network, fromAddress, token }
        )

        // 2. Check total amount
        if (token !== "USDT") throw new Error(`Token ${token} is not supported.`); // *** Only USDT supported for batch transfer ***
        const decimals = 6; // USDT decimals
        const tokenAmounts = recipients.map(r =>
            this.tronWeb.toBigNumber(r.amount).times(this.tronWeb.toBigNumber(10).pow(decimals))
        );

        const totalAmount = tokenAmounts.reduce(
            (a: BigNumber, b: BigNumber) => a.plus(b),
            this.tronWeb.toBigNumber(0)
        );
        const totalAmountStr = totalAmount.toFixed(0); // String to avoid precision issues in JS

        // 3. If allowance is insufficient, approve first
        if (this.tronWeb.toBigNumber(allowance).lt(totalAmount)) {
            const { unsignedTx } = await api<{ unsignedTx: Transaction }>(
                '/api/transfer/approvement',
                { network, fromAddress, token, amount: totalAmountStr }
            )

            const signedTx = await this.sign(unsignedTx);
            const { txid } = await this.broadcast(signedTx);

            return { sufficient: false, txid, totalAmount: totalAmountStr };
        }
        return { sufficient: true, totalAmount: totalAmountStr };
    }

    // Batch transfer (complete process)
    async batchTransfer(payload: {
        network: Network,
        token: string,
        recipients: { toAddress: string, amount: number }[]
    }): Promise<{ txid: string }> {
        const fromAddress = this.getAddress();
        // 1. Build batch transfer unsigned transaction
        const { unsignedTx } = await api<{ unsignedTx: Transaction }>(
            '/api/transfer/batch',
            { fromAddress, ...payload }
        )
        if (!unsignedTx) throw new Error("Failed to get unsigned transaction");

        // 2. Sign batch transaction
        const signedBatchTx = await this.sign(unsignedTx);

        // 3. Broadcast batch transaction
        const { txid } = await this.broadcast(signedBatchTx);
        return { txid };
    }
}

export default TronFrontendService;