
import { BigNumber, TronWeb } from "tronweb";
import { Network } from "@/models/network";
import { Account, AccountResource, TronGridTrc20Response, TronGridTrc20Transaction } from "@/models/tronResponse";
import { rateLimiter } from "./rateLimitService";
import { ALLOWED_TOKENS, RENTAL_PACKAGES } from "@/models/transfer";
import { batchSenderAbi } from "@/models/abi";

class TronService {
    private static publicInstance: TronWeb;
    private static publicShastaInstance: TronWeb;

    private API_ENDPOINTS = {
        mainnet: 'https://api.trongrid.io',
        shasta: 'https://api.shasta.trongrid.io',
        tronscan_mainnet: "https://apilist.tronscanapi.com",
        tronscan_shasta: "https://shastapi.tronscan.org",
    }

    private static RENTAL_PACKAGES = RENTAL_PACKAGES;
    private static ALLOWED_TOKENS = ALLOWED_TOKENS;
    private tronZapAddress = "TQssuzjvQbqtmEjmd9sGHuBQMdpvrCov3h";

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

    private connectPrivateTron = async (payload: { network: Network, privateKey: string }): Promise<TronWeb> => {
        const { network, privateKey } = payload;
        const tronWeb = new TronWeb({
            fullHost: this.API_ENDPOINTS[network],
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
        "BATCH_SENDER_CONTRACT": {
            mainnet: "",
            shasta: "TEzF63sbFzgSkg8nCZcXKWu6UvzziVoPzx"
        }
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
            if (!TronService.ALLOWED_TOKENS.has(token)) throw new Error(`Token ${token} is not supported.`);

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
            if (!contractAddress) { throw new Error(`Unsupported token: ${token}`); }

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

            const freeBandwidthAvailable = (resources.freeNetLimit || 0) - freeNetUsed;
            const stakedBandwidthAvailable = (resources.NetLimit || 0) - netUsed;
            const totalBandwidthAvailable = freeBandwidthAvailable + stakedBandwidthAvailable;

            const energyAvailable = (resources.EnergyLimit || 0) - energyUsed;

            return { energy: energyAvailable, bandwidth: totalBandwidthAvailable };
        } catch (error) {
            throw error;
        }
    }

    // Get account resources via TronScan API
    getAccountRecoursesViaTronScan = async (payload: { network: Network, address: string }): Promise<{ trx: number, usdt: number, energy: number, bandwidth: number }> => {
        try {
            const { network, address } = payload;
            const baseUrl = this.API_ENDPOINTS[`tronscan_${network}` as keyof typeof this.API_ENDPOINTS];
            if (!baseUrl) throw new Error("Unsupported network");

            const url = new URL('/api/account', baseUrl);
            url.searchParams.append('address', address);

            const res = await rateLimiter.executeWithQueue(
                async () => await fetch(url.toString(), {
                    headers: {
                        'TRON-PRO-API-KEY': process.env.TRONSCAN_API_KEY || '',
                    }
                })
            )
            if (!res.ok) {
                const result = await res.json()
                throw new Error(result.message || `TronScan API Error: ${res.status}`);
            }

            const result = await res.json();

            const balanceInfo = result.balances[0] || {};
            const trx = balanceInfo ? Number(balanceInfo.amount) || 0 : 0;

            const usdtInfo = result.trc20token_balances.find((token: any) => token.tokenId === this.ADDRESS_MAP["USDT"][network]);
            const usdt = usdtInfo ? (Number(usdtInfo.balance) / Math.pow(10, usdtInfo.tokenDecimal)) || 0 : 0;

            const bandwidth = result.bandwidth || {};
            const netLimit = bandwidth.freeNetLimit + (bandwidth.netLimit || 0);
            const netUsed = bandwidth.freeNetUsed + (bandwidth.netUsed || 0);
            const netAvailable = netLimit - netUsed;

            const energyLimit = bandwidth.energyLimit || 0;
            const energyUsed = bandwidth.energyUsed || 0;
            const energyAvailable = energyLimit - energyUsed;

            return { trx, usdt, energy: energyAvailable, bandwidth: netAvailable };
        } catch (error) {
            throw error;
        }
    }

    // Get sender profile (TRX, USDT balance, energy, bandwidth)
    getSenderProfile = async (payload: { network: Network, address: string }): Promise<{ trx: number; usdt: number; energy: number; bandwidth: number }> => {
        try {
            const { network, address } = payload;
            const { trx, usdt, energy, bandwidth } = await this.getAccountRecoursesViaTronScan({ network, address });
            return { trx, usdt, energy, bandwidth };
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

    estimateEnergy = async (payload: {
        network: Network,
        fromAddress: string,
        toAddress: string,
        token: string,
        amount: number
    }): Promise<number> => {
        const { network, fromAddress, toAddress, token, amount } = payload;
        if (network != "mainnet" || token === "TRX") return 0;
        const tronWeb = this.getInstance(network);

        try {
            if (!TronService.ALLOWED_TOKENS.has(token)) throw new Error(`Token ${token} is not supported.`);
            const contractAddress = this.ADDRESS_MAP[token][network];
            if (!contractAddress) throw new Error(`Unsupported token: ${token}`);

            let decimals: number;
            if (token === "USDT") {
                decimals = 6;
            } else {
                const contract = await rateLimiter.executeWithQueue(
                    async () => {
                        const contract = await tronWeb.contract().at(contractAddress);
                        return contract;
                    }
                );
                const decimalsResult = await rateLimiter.executeWithQueue(
                    async () => await contract.decimals().call()
                );
                decimals = Number(decimalsResult);
            }

            const tokenAmount = tronWeb.BigNumber(amount).times(tronWeb.BigNumber(10).pow(decimals)).toString();

            const simulation = await this.simulateTransfer({
                network,
                tronWeb,
                contractAddress,
                fromAddress,
                toAddress,
                tokenAmount,
                batchMode: false
            });
            if (!simulation.result?.result) {
                throw new Error(simulation.result?.message || "Transaction simulation failed");
            }

            const estimatedEnergy = simulation.energy_used || 0;
            return estimatedEnergy;
        } catch (error) {
            console.error('Failed to estimate energy:', error);
            throw error;
        }
    }

    // Rent energy from TronZap
    rentEnergy = async (payload: {
        network: Network,
        address: string,
        privateKey: string,
        energyReq?: number,
    }): Promise<{ success: boolean, data?: any, message?: string, skip?: boolean }> => {
        const {
            network,
            address,
            privateKey,
            energyReq = 131000,
        } = payload;

        try {
            if (network !== "mainnet") return { success: true, message: 'Only mainnet supported for energy rental.', skip: true };

            const { energy: energyBalance = 0 } = await this.getAccountResources({ network, address });
            const missingEnergy = Math.max(0, energyReq - energyBalance);
            if (missingEnergy === 0) return { success: true, message: `Energy sufficient.`, skip: true };

            let remainingNeeded = missingEnergy;
            let totalAmount = 0;

            const premiumPkg = TronService.RENTAL_PACKAGES[0];
            const premiumCount = Math.floor(remainingNeeded / premiumPkg.energy);
            if (premiumCount > 0) {
                totalAmount += premiumCount * premiumPkg.price;
                remainingNeeded -= premiumCount * premiumPkg.energy;
            }

            if (remainingNeeded > 0) {
                const stdPkg = TronService.RENTAL_PACKAGES[1];
                if (remainingNeeded > stdPkg.energy) {
                    totalAmount += premiumPkg.price;
                } else {
                    totalAmount += stdPkg.price;
                }
            }

            const receipt = await this.transferTrx({
                network,
                privateKey,
                fromAddress: address,
                toAddress: this.tronZapAddress,
                amount: totalAmount,
            });
            if (!receipt.result) throw new Error(receipt.message || "Energy rental failed");
            return { success: receipt.result, data: receipt, message: 'Energy rental submitted. Confirmation usually takes 20-60 seconds.' };
        } catch (error) {
            throw error;
        }
    }

    // Check transaction status via TronWeb API
    checkTransaction = async (payload: { network?: Network, txid: string, token: string }) => {
        const { network = "mainnet", txid, token } = payload;
        try {
            const tronWeb = this.getInstance(network);
            const result = await rateLimiter.executeWithQueue(
                async () => await tronWeb.trx.getTransactionInfo(txid)
            );
            if (!result || Object.keys(result).length === 0) {
                return { completed: false, confirmed: false }; // Use completed to indicate tx not found
            }

            const code = result.receipt?.result;
            if (code) {
                if (code !== 'SUCCESS') {
                    return {
                        completed: true,
                        confirmed: false,
                        error: code || "Transaction failed",
                        block: result.blockNumber,
                        timestamp: result.blockTimeStamp,
                    }
                } else {
                    return {
                        completed: true,
                        confirmed: true,
                        block: result.blockNumber,
                        timestamp: result.blockTimeStamp,
                    }
                }
            }

            if (token === "TRX") {
                if (result.receipt?.result && result.receipt.result !== 'SUCCESS') {
                    return {
                        completed: true,
                        confirmed: false,
                        blockNumber: result.blockNumber,
                        timestamp: result.blockTimeStamp,
                    };
                } else if (result.blockNumber && result.receipt && !result.receipt.result) {
                    return {
                        completed: true,
                        confirmed: true,
                        blockNumber: result.blockNumber,
                        timestamp: result.blockTimeStamp,
                    };
                }
            }

            return { completed: false, confirmed: false };
        } catch (error) {
            throw error;
        }
    }

    // Simulate contract call to check if transaction would succeed and estimate energy
    private simulateTransfer = async (payload: {
        tronWeb: TronWeb,
        network: Network,
        contractAddress: string,
        fromAddress: string,
        batchMode?: boolean,
        toAddress?: string,
        tokenAmount?: string,
        toAddresses?: string[], // Batch transfer
        tokenAmountStr?: string[] // Batch transfer
    }) => {
        const { tronWeb, network, contractAddress, fromAddress, batchMode, toAddress, tokenAmount, toAddresses, tokenAmountStr } = payload;

        // 1. Pre-check
        if (!batchMode && (!toAddress || !tokenAmount)) {
            throw new Error("Missing required parameters for single transfer simulation");
        }
        if (batchMode && (!toAddresses || !tokenAmountStr)) {
            throw new Error("Missing required parameters for batch transfer simulation");
        }
        if (network === "shasta") {
            return { result: { result: true, message: "Simulation skipped on Shasta network" }, energy_used: 0 };
        }

        // 2. Parameter setup
        const functionSelector = batchMode ? 'multisendToken(address,address[],uint256[])' : 'transfer(address,uint256)';
        const feeLimit = batchMode ? 500_000_000 : 50_000_000;
        const parameters = batchMode
            ? [
                { type: 'address', value: this.ADDRESS_MAP["USDT"][network] },
                { type: 'address[]', value: toAddresses },
                { type: 'uint256[]', value: tokenAmountStr },
            ]
            : [
                { type: 'address', value: toAddress },
                { type: 'uint256', value: tokenAmount }
            ];

        // 3. Simulate transaction
        const result = await rateLimiter.executeWithQueue(
            async () => await tronWeb.transactionBuilder.triggerConstantContract(
                contractAddress,
                functionSelector,
                { feeLimit },
                parameters,
                fromAddress
            )
        );

        return result;
    };

    // Transfer TRX
    transferTrx = async (payload: {
        network: Network,
        privateKey: string,
        fromAddress: string,
        toAddress: string,
        amount: number
    }) => {
        try {
            const { network, privateKey, fromAddress, toAddress, amount } = payload;
            if (amount <= 0) {
                throw new Error("Amount must be greater than zero");
            }
            const tronWeb = await this.connectPrivateTron({ network, privateKey });
            if (!tronWeb) {
                throw new Error("Failed to connect to TRON network");
            }

            const sunAmount = Number(tronWeb.toSun(amount));
            const tradeobj = await rateLimiter.executeWithQueue(
                async () => await tronWeb.transactionBuilder.sendTrx(
                    toAddress, sunAmount, fromAddress
                )
            );
            const signedtxn = await tronWeb.trx.sign(tradeobj);
            const receipt = await rateLimiter.executeWithQueue(
                async () => await tronWeb.trx.sendRawTransaction(signedtxn)
            );

            return receipt;
        } catch (error) {
            throw error;
        }
    }

    // Transfer TRC20 / TRX tokens (single transfer)
    singleTransfer = async (payload: {
        network: Network,
        fromAddress: string,
        toAddress: string,
        privateKey: string,
        token: string,
        amount: number,
        simulateOnly?: boolean
    }): Promise<{ success: boolean, data?: any }> => {
        try {
            const { network, fromAddress, toAddress, privateKey, token, amount, simulateOnly = false } = payload;
            if (amount <= 0) throw new Error("Amount must be greater than zero");

            const tronWeb = await this.connectPrivateTron({ network, privateKey });
            if (!tronWeb) throw new Error("Failed to connect to TRON network");

            if (!TronService.ALLOWED_TOKENS.has(token)) throw new Error(`Token ${token} is not supported.`);
            if (token === "TRX") {
                if (simulateOnly) {
                    return {
                        success: true,
                        data: { energy_used: 0 }
                    }
                } else {
                    const receipt = await this.transferTrx({
                        network,
                        privateKey,
                        fromAddress,
                        toAddress,
                        amount
                    });
                    if (receipt.code) {
                        throw new Error(receipt.code.toString() || "TRX transfer failed");
                    }
                    return { success: true, data: { txid: receipt.txid } };
                }
            }

            const contractAddress = this.ADDRESS_MAP[token][network];
            if (!contractAddress) throw new Error(`Unsupported token: ${token}`);
            const contract = await rateLimiter.executeWithQueue(
                async () => await tronWeb.contract().at(contractAddress)
            );

            const decimals = token === "USDT" ? 6 : await rateLimiter.executeWithQueue(
                async () => await contract.decimals().call()
            );
            const tokenAmount = tronWeb.BigNumber(amount)
                .times(tronWeb.BigNumber(10).pow(decimals))
                .toString();

            if (simulateOnly) {
                const simulation = await this.simulateTransfer({
                    network,
                    tronWeb,
                    contractAddress,
                    fromAddress,
                    toAddress,
                    tokenAmount,
                    batchMode: false
                });
                if (!simulation.result?.result) {
                    throw new Error(simulation.result?.message || "Transaction simulation failed");
                }
                return { success: true, data: simulation };
            } else {
                const txid = await rateLimiter.executeWithQueue(
                    async () => await contract.transfer(toAddress, tokenAmount).send({
                        feeLimit: 50_000_000,
                        callValue: 0,
                        shouldPollResponse: false
                    })
                );

                return { success: true, data: { txid } };
            }
        } catch (error) {
            throw error;
        }
    }

    batchTransfer = async (payload: {
        network: Network,
        fromAddress: string,
        privateKey: string,
        token: string,
        recipients: { toAddress: string, amount: number }[],
        simulateOnly?: boolean
    }) => {
        try {
            const { network, fromAddress, privateKey, token = "USDT", recipients, simulateOnly = false } = payload;

            // 1. Pre-check
            if (recipients.length <= 0) throw new Error("No recipients provided");
            if (token !== "USDT") throw new Error(`Token ${token} is not supported.`); // Only USDT supported for batch transfer
            const decimals = 6; // USDT decimals

            const tronWeb = await this.connectPrivateTron({ network, privateKey });
            if (!tronWeb) throw new Error("Failed to connect to TRON network");

            const usdtAddr = this.ADDRESS_MAP["USDT"][network];
            const batchAddr = this.ADDRESS_MAP["BATCH_SENDER_CONTRACT"][network];
            if (!usdtAddr || !batchAddr) throw new Error("Contracts configuration missing");

            // 2. Prepare batch transfer data
            const toAddresses = recipients.map(r => r.toAddress);

            const tokenAmounts = recipients.map(r => { return tronWeb.toBigNumber(r.amount).times(tronWeb.toBigNumber(10).pow(decimals)) });
            const tokenAmountStr = tokenAmounts.map(a => a.toFixed(0));

            const totalAmount = tokenAmounts.reduce((a: BigNumber, b: BigNumber) => a.plus(b), tronWeb.toBigNumber(0));
            const totalAmountStr = totalAmount.toFixed(0);

            // 3. Check allowance and approve if needed
            const usdtContract = await tronWeb.contract().at(usdtAddr);
            const allowance = await usdtContract.allowance(fromAddress, batchAddr).call();

            if (tronWeb.toBigNumber(allowance).lt(totalAmount)) {
                const approveTx = await usdtContract.approve(batchAddr, totalAmountStr).send();
                let allowed: boolean = false;
                for (let i = 0; i < 20; i++) {
                    const result = await rateLimiter.executeWithQueue(
                        async () => await tronWeb.trx.getTransactionInfo(approveTx)
                    );
                    if (result && result.receipt?.result === 'SUCCESS') {
                        allowed = true;
                        break;
                    }
                    await new Promise(res => setTimeout(res, 6000));
                }
                if (!allowed) {
                    return { success: false, timeout: true, message: "Approval transaction not confirmed in time. Please check the transaction status and try again." }
                }
            }

            if (simulateOnly) {
                // 4A. Simulate batch transfer
                const simulation = await this.simulateTransfer({
                    tronWeb,
                    network,
                    contractAddress: batchAddr,
                    fromAddress,
                    toAddresses,
                    tokenAmountStr,
                    batchMode: true
                });
                if (!simulation.result?.result) {
                    throw new Error(simulation.result?.message || "Batch transfer simulation failed");
                }
                return { success: true, data: simulation };
            } else {
                // 4B. Execute batch transfer
                const batchContract = tronWeb.contract(batchSenderAbi, batchAddr);
                const txid = await rateLimiter.executeWithQueue(
                    async () => batchContract.multisendToken(
                        usdtAddr,
                        toAddresses,
                        tokenAmountStr
                    ).send({
                        feeLimit: 500_000_000
                    })
                );
                return { success: true, data: txid };
            }
        } catch (error) {
            console.error("Batch Transfer Failed:", error);
            return { success: false, error: (error as Error).message };
        }
    }

}

const tronService = new TronService();
export default tronService;