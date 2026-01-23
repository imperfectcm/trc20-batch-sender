import { TronWeb } from "tronweb";

class TronService {
    private static publicInstance: TronWeb;

    constructor() {
        if (!TronService.publicInstance) {
            TronService.publicInstance = new TronWeb({
                fullHost: 'https://api.trongrid.io',
                headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY },
            });
        }
    }

    // Get TRX balance of an address
    getBalance(address: string): Promise<number> {
        try {
            const tronInstance = TronService.publicInstance;
            return tronInstance.trx.getBalance(address);
        } catch (error) {
            throw error;
        }
    }



}

const tronService = new TronService();
export default tronService;