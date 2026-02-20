import { Network } from "@/models/network";
import { TronWeb } from "tronweb";
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapters';

export interface ISigner {
    getAddress(): string;
    getTronWeb(): TronWeb;
    sign(transaction: any): Promise<any>;
}

class PrivateKeySigner implements ISigner {
    private tronWeb: TronWeb;
    private address: string;

    constructor(network: Network, privateKey: string) {
        this.tronWeb = new TronWeb({
            fullHost: network === 'mainnet'
                ? 'https://api.trongrid.io'
                : 'https://api.shasta.trongrid.io',
            headers: { "TRON-PRO-API-KEY": process.env.TRONWEB_API_KEY },
            privateKey
        });
        this.address = this.tronWeb.defaultAddress.base58.toString();
    }

    getAddress(): string {
        return this.address;
    }

    getTronWeb(): TronWeb {
        return this.tronWeb;
    }

    async sign(transaction: any): Promise<any> {
        return await this.tronWeb.trx.sign(transaction);
    }
}

class AdapterSigner implements ISigner {
    private tronWeb: TronWeb;
    private adapter: TronLinkAdapter;

    constructor(network: Network, adapter: TronLinkAdapter) {
        this.adapter = adapter;
        this.tronWeb = new TronWeb({
            fullHost: network === 'mainnet'
                ? 'https://api.trongrid.io'
                : 'https://api.shasta.trongrid.io',
            headers: { "TRON-PRO-API-KEY": process.env.TRONWEB_API_KEY }
        });
    }

    getAddress(): string {
        if (!this.adapter.connected) {
            throw new Error("Adapter not connected");
        }
        return this.adapter.address!;
    }

    getTronWeb(): TronWeb {
        return this.tronWeb;
    }

    async sign(transaction: any): Promise<any> {
        if (!this.adapter.connected) {
            await this.adapter.connect();
        }
        return await this.adapter.signTransaction(transaction);
    }
}

export { PrivateKeySigner, AdapterSigner };