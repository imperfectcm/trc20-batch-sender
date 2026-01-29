
import { Network } from "@/models/network";
import { Account, AccountResource, TronGridTrc20Response, TronGridTrc20Transaction } from "@/models/tronResponse";
import { TronWeb } from "tronweb";
import { rateLimiter } from "./rateLimitService";

class TronService {
    private static publicInstance: TronWeb;
    private static publicShastaInstance: TronWeb;
    private API_ENDPOINTS = {
        mainnet: 'https://api.trongrid.io',
        shasta: 'https://api.shasta.trongrid.io',
    }

    constructor() {
        if (!TronService.publicInstance) {
            TronService.publicInstance = new TronWeb({
                fullHost: this.API_ENDPOINTS.mainnet,
                headers: { "TRON-PRO-API-KEY": process.env.TRONWEB_API_KEY },
            });
        }
        if (!TronService.publicShastaInstance) {
            TronService.publicShastaInstance = new TronWeb({
                fullHost: this.API_ENDPOINTS.shasta,
                headers: { "TRON-PRO-API-KEY": process.env.TRONWEB_API_KEY },
            });
        }
    }

    private connectPrivateTron = async (privateKey: string): Promise<TronWeb> => {
        const tronWeb = new TronWeb({
            fullHost: this.API_ENDPOINTS.mainnet,
            headers: { "TRON-PRO-API-KEY": process.env.TRONWEB_API_KEY },
            privateKey,
        });
        return tronWeb;
    }

    private ADDRESS_MAP: Record<string, Record<Network, string>> = {
        "USDT": {
            mainnet: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            shasta: "TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs"
        },
    }

    // Select TronWeb instance based on network
    getInstance = (network: Network = 'mainnet'): TronWeb => {
        if (network !== 'mainnet' && network !== 'shasta') {
            throw new Error("Unsupported network");
        }
        return network === 'mainnet' ? TronService.publicInstance : TronService.publicShastaInstance;
    }

    // Validate TRON address
    validateAddress = async (address: string): Promise<boolean> => {
        try {
            const res = TronWeb.isAddress(address);
            return res;
        } catch (error: any) {
            throw error;
        }
    }

    // Validate private key
    validatePrivateKey = async (payload: { address: string, privateKey: string }): Promise<boolean> => {
        try {
            const { address, privateKey } = payload;
            if (!address) {
                throw new Error("No address provided");
            }

            // In case of mnemonic phrase
            if (privateKey.includes(" ")) {
                try {
                    const account = TronWeb.fromMnemonic(privateKey);
                    const isValid = address === account.address;
                    return isValid;
                } catch (error) {
                    throw new Error("Invalid mnemonic phrase");
                }
            }

            const cleanKey = privateKey.replace(/^0x/, "");
            if (cleanKey.length !== 64) {
                throw new Error("Invalid private key length");
            }
            if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
                throw new Error("Private key contains invalid characters");
            }

            const generatedAddress = TronWeb.address.fromPrivateKey(cleanKey);
            const isValid = address === generatedAddress;
            return isValid;
        } catch (error: any) {
            throw error;
        }
    }

    // Get TRX balance of an address
    getBalance = async (payload: { network: Network, address: string, token: string }): Promise<number> => {
        try {
            const { network, address, token } = payload;
            const tronWeb = this.getInstance(network);
            if (token === "TRX") {
                const balanceInSun = await rateLimiter.executeWithQueue(
                    async () => await tronWeb.trx.getBalance(address)
                );
                const balance = Number(tronWeb.fromSun(balanceInSun));
                if (isNaN(balance)) {
                    throw new Error("Failed to fetch TRX balance");
                }
                return balance;
            }

            const contractAddress = this.ADDRESS_MAP[token][network];
            if (!contractAddress) {
                throw new Error("Unsupported token");
            }

            const contract = await rateLimiter.executeWithQueue(
                async () => await tronWeb.contract().at(contractAddress)
            );
            const res = await rateLimiter.executeWithQueue(
                async () => await contract.balanceOf(address).call({ from: address })
            );
            const decimals = token === "USDT" ? 6 : await rateLimiter.executeWithQueue(
                async () => await contract.decimals().call()
            );
            const balanceBig = tronWeb.BigNumber(res);
            const divider = tronWeb.BigNumber(10).pow(decimals);

            const balance = balanceBig.div(divider).toNumber();
            if (isNaN(balance)) {
                throw new Error(`Failed to fetch ${token} balance`);
            }
            return balance;
        } catch (error) {
            throw error;
        }
    }

    // Get account info
    getAccount = async (payload: { network: Network, address: string }): Promise<Account> => {
        try {
            const { network, address } = payload;
            const tronWeb = this.getInstance(network);
            const account = await rateLimiter.executeWithQueue(
                async () => await tronWeb.trx.getAccount(address)
            );
            return account;
        } catch (error) {
            throw error;
        }
    }

    // Get account resources (eg. energy, bandwidth)
    getAccountResources = async (payload: { network: Network, address: string }): Promise<{ energy: number, bandwidth: number }> => {
        try {
            const { network, address } = payload;
            const tronWeb = this.getInstance(network);
            const resources: AccountResource = await rateLimiter.executeWithQueue(
                async () => await tronWeb.trx.getAccountResources(address)
            );

            const freeNetUsed = resources.freeNetUsed || 0;
            const netUsed = resources.NetUsed || 0;
            const energyUsed = resources.EnergyUsed || 0;

            const freeBandwidthRemaining = (resources.freeNetLimit || 0) - freeNetUsed;
            const stakedBandwidthRemaining = (resources.NetLimit || 0) - netUsed;
            const totalBandwidthRemaining = freeBandwidthRemaining + stakedBandwidthRemaining;

            const energyRemaining = (resources.EnergyLimit || 0) - energyUsed;

            return { energy: energyRemaining, bandwidth: totalBandwidthRemaining };
        } catch (error) {
            throw error;
        }
    }

    // Get sender profile (TRX, USDT balance, energy, bandwidth)
    getSenderProfile = async (payload: { network: Network, address: string }): Promise<{ trx: number; usdt: number; energy: number; bandwidth: number }> => {
        try {
            const { network, address } = payload;
            const tronWeb = this.getInstance(network);
            const [account, usdt, resources] = await Promise.all([
                this.getAccount({ network, address }),
                this.getBalance({ network, address, token: "USDT" }),
                this.getAccountResources({ network, address }),
            ]);
            const trx = Number(tronWeb.fromSun(account.balance));
            console.log("Fetch profile time: ", new Date().toISOString());
            return { trx, usdt, energy: resources.energy, bandwidth: resources.bandwidth };
        } catch (error) {
            throw error;
        }
    }

    // Get recent TRC20 transfer records
    getRecentTransfers = async (payload: { network?: Network, address: string, limit?: number, onlyConfirmed?: boolean }): Promise<TronGridTrc20Transaction[]> => {
        try {
            const { network = "mainnet", address, limit = 20, onlyConfirmed } = payload;
            const baseUrl = this.API_ENDPOINTS[network];
            if (!baseUrl) {
                throw new Error("Unsupported network");
            }

            const url = `${baseUrl}/v1/accounts/${address}/transactions/trc20`;
            const params = new URLSearchParams({
                limit: limit.toString(),
                only_confirmed: (onlyConfirmed ?? true).toString(),
                order_by: 'block_timestamp,desc'
            });

            const res = await rateLimiter.executeWithQueue(
                async () => {
                    const res = await fetch(`${url}?${params}`);
                    return res;
                }
            );
            const result: TronGridTrc20Response = await res.json();
            if (!result || !result.success) {
                throw new Error("Failed to fetch transfer records");
            }
            return result.data || [];
        } catch (error) {
            throw error;
        }
    }



}

const tronService = new TronService();
export default tronService;