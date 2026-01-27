
import { TronWeb } from "tronweb";

class TronService {
    private static publicInstance: TronWeb;

    constructor() {
        if (!TronService.publicInstance) {
            TronService.publicInstance = new TronWeb({
                fullHost: 'https://api.trongrid.io',
                headers: { "TRON-PRO-API-KEY": process.env.TRONWEB_API_KEY },
            });
        }
    }

    private connectPrivateTron = async (privateKey: string): Promise<TronWeb> => {
        const tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io',
            headers: { "TRON-PRO-API-KEY": process.env.TRONWEB_API_KEY },
            privateKey,
        });
        return tronWeb;
    }

    private contractAddressMap: Record<string, string> = {
        "USDT": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
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

    validatePrivateKey = async (privateKey: string): Promise<boolean> => {
        try {
            const cleanKey = privateKey.replace(/^0x/, "");
            if (cleanKey.length !== 64) {
                throw new Error("Invalid private key length");
            }
            if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
                throw new Error("Private key contains invalid characters");
            }

            const address = TronWeb.address.fromPrivateKey(cleanKey);
            const isValid = TronWeb.isAddress(address);
            return isValid;
        } catch (error: any) {
            throw error;
        }
    }

    // Get TRX balance of an address
    getBalance = async (payload: { address: string, token: string }): Promise<number> => {
        try {
            const { address, token } = payload;
            if (token === "TRX") {
                const balanceInSun = await TronService.publicInstance.trx.getBalance(address);
                const balance = Number(TronService.publicInstance.fromSun(balanceInSun));
                if (isNaN(balance)) {
                    throw new Error("Failed to fetch TRX balance");
                }
                return balance;
            }

            const contractAddress = this.contractAddressMap[token];
            if (!contractAddress) {
                throw new Error("Unsupported token");
            }

            const contract = await TronService.publicInstance.contract().at(contractAddress);
            const res = await contract.balanceOf(address).call({ from: address });
            const decimals = token === "USDT" ? 6 : await contract.decimals().call();
            const balanceBig = TronService.publicInstance.BigNumber(res);
            const divider = TronService.publicInstance.BigNumber(10).pow(decimals);

            const balance = balanceBig.div(divider).toNumber();
            if (isNaN(balance)) {
                throw new Error(`Failed to fetch ${token} balance`);
            }
            return balance;

        } catch (error) {
            throw error;
        }
    }




}

const tronService = new TronService();
export default tronService;