
import { TronWeb } from "tronweb";
import { Network } from "@/models/network";
import { Account, AccountResource, TronGridTrc20Response, TronGridTrc20Transaction } from "@/models/tronResponse";
import { rateLimiter } from "./rateLimitService";
import { ADDRESS_MAP, ALLOWED_TOKENS, RENTAL_PACKAGES, TRONZAP_ADDRESS } from "@/models/transfer";
import { Transaction } from '@tronweb3/tronwallet-abstract-adapter';
import { API_ENDPOINTS } from "@/models/network";

class TronService {
    private static publicInstance: TronWeb;
    private static publicShastaInstance: TronWeb;

    private static API_ENDPOINTS = API_ENDPOINTS
    private static ALLOWED_TOKENS = ALLOWED_TOKENS;
    private static ADDRESS_MAP = ADDRESS_MAP;

    private static TRONZAP_ADDRESS = TRONZAP_ADDRESS;
    private static RENTAL_PACKAGES = RENTAL_PACKAGES;

    constructor() {
        if (!TronService.publicInstance) {
            TronService.publicInstance = new TronWeb({
                fullHost: TronService.API_ENDPOINTS.mainnet,
                headers: { "TRON-PRO-API-KEY": process.env.TRONWEB_API_KEY },
            });
        }
        if (!TronService.publicShastaInstance) {
            TronService.publicShastaInstance = new TronWeb({
                fullHost: TronService.API_ENDPOINTS.shasta,
                headers: { "TRON-PRO-API-KEY": process.env.TRONWEB_API_KEY },
            });
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
    validateAddress = (address: string): boolean => TronWeb.isAddress(address);

    // Validate private key
    validatePrivateKey = async (payload: { address: string, privateKey: string }): Promise<boolean> => {
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
    }

    // Get account info
    getAccount = async (payload: { network: Network, address: string }): Promise<Account> => {
        const { network, address } = payload;
        const tronWeb = this.getInstance(network);
        const account = await rateLimiter.executeWithQueue(
            async () => await tronWeb.trx.getAccount(address)
        );
        return account;
    }

    // Get account resources (eg. energy, bandwidth)
    getAccountResources = async (payload: { network: Network, address: string }): Promise<{ energy: number, bandwidth: number }> => {
        const { network, address } = payload;
        const tronWeb = this.getInstance(network);
        const resources: AccountResource = await rateLimiter.executeWithQueue(
            async () => await tronWeb.trx.getAccountResources(address)
        );

        const energy = (resources.EnergyLimit || 0) - (resources.EnergyUsed || 0);
        const bandwidth = (resources.freeNetLimit || 0) - (resources.freeNetUsed || 0)
            + (resources.NetLimit || 0) - (resources.NetUsed || 0);
        return { energy, bandwidth };
    }

    // Get account resources via TronScan API
    getAccountRecoursesViaTronScan = async (payload: { network: Network, address: string }): Promise<{ trx: number, usdt: number, energy: number, bandwidth: number }> => {
        const { network, address } = payload;
        const baseUrl = TronService.API_ENDPOINTS[`tronscan_${network}` as keyof typeof TronService.API_ENDPOINTS];
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

        const usdtInfo = result.trc20token_balances.find((token: any) => token.tokenId === TronService.ADDRESS_MAP["USDT"][network]);
        const usdt = usdtInfo ? (Number(usdtInfo.balance) / Math.pow(10, usdtInfo.tokenDecimal)) || 0 : 0;

        const bandwidth = result.bandwidth || {};
        const netLimit = bandwidth.freeNetLimit + (bandwidth.netLimit || 0);
        const netUsed = bandwidth.freeNetUsed + (bandwidth.netUsed || 0);
        const netAvailable = netLimit - netUsed;

        const energyLimit = bandwidth.energyLimit || 0;
        const energyUsed = bandwidth.energyUsed || 0;
        const energyAvailable = energyLimit - energyUsed;

        return { trx, usdt, energy: energyAvailable, bandwidth: netAvailable };
    }

    // Get sender profile (TRX, USDT balance, energy, bandwidth)
    getSenderProfile = this.getAccountRecoursesViaTronScan;

    // Get recent TRC20 transfer records
    getRecentTransfers = async (payload: { network?: Network, address: string, limit?: number, onlyConfirmed?: boolean }): Promise<TronGridTrc20Transaction[]> => {
        const { network = "mainnet", address, limit = 50, onlyConfirmed } = payload;
        const baseUrl = TronService.API_ENDPOINTS[network];
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
            async () => fetch(`${url}?${params}`)
        );
        const result: TronGridTrc20Response = await res.json();
        if (!result || !result.success) {
            throw new Error("Failed to fetch transfer records");
        }
        const transfers = result.data.filter(tx => tx.type === "Transfer");
        return transfers || [];
    }

    // Rent energy from TronZap
    rentEnergy = async (payload: {
        network: Network,
        address: string,
        energyReq?: number,
    }): Promise<{ unsignedTx?: Transaction, message?: string, skip?: boolean }> => {
        const {
            network,
            address,
            energyReq = 131000,
        } = payload;

        if (network !== "mainnet") return { message: 'Only mainnet supported for energy rental.', skip: true };

        const { energy: energyBalance = 0 } = await this.getAccountResources({ network, address });
        const missingEnergy = Math.max(0, energyReq - energyBalance);
        if (missingEnergy === 0) return { message: `Energy sufficient.`, skip: true };

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
        console.info(`Energy rental needed. Missing: ${missingEnergy}, Total cost: $${totalAmount.toFixed(2)} TRX`);
        const res = await this.buildTrxTransfer({
            network,
            fromAddress: address,
            toAddress: TronService.TRONZAP_ADDRESS,
            amount: totalAmount,
        });
        return { unsignedTx: res.unsignedTx, message: 'Energy rental submitted. Confirmation usually takes 20-60 seconds.' };
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
                { type: 'address', value: TronService.ADDRESS_MAP["USDT"][network] },
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

    // Transfer TRX (Sign in frontend)
    buildTrxTransfer = async (payload: {
        network: Network
        fromAddress: string,
        toAddress: string,
        amount: number
    }): Promise<{ unsignedTx: Transaction }> => {
        const { network, fromAddress, toAddress, amount } = payload;
        if (amount <= 0) {
            throw new Error("Amount must be greater than zero");
        }

        const tronWeb = this.getInstance(network);
        const sunAmount = Number(tronWeb.toSun(amount));
        const unsignedTx = await rateLimiter.executeWithQueue(
            async () => await tronWeb.transactionBuilder.sendTrx(
                toAddress, sunAmount, fromAddress,
            )
        );

        return { unsignedTx };
    }

    // Transfer TRC20 / TRX tokens (single transfer)
    buildSingleTransfer = async (payload: {
        network: Network,
        fromAddress: string,
        toAddress: string,
        token: string,
        amount: number,
        simulateOnly?: boolean
    }): Promise<{ energy_used: number } | { unsignedTx: Transaction }> => {
        // *** used_energy for simulation, unsignedTx for actual transfer ***
        const { network, fromAddress, toAddress, token, amount, simulateOnly = false } = payload;
        if (amount <= 0) throw new Error("Amount must be greater than zero");
        if (!TronService.ALLOWED_TOKENS.has(token)) throw new Error(`Token ${token} is not supported.`);

        // TRX transfer
        if (token === "TRX") {
            if (simulateOnly) {
                return { energy_used: 0 }
            } else {
                return await this.buildTrxTransfer({
                    network,
                    fromAddress,
                    toAddress,
                    amount,
                });
            }
        }

        // TRC20 token transfer
        const tronWeb = this.getInstance(network);
        const contractAddress = TronService.ADDRESS_MAP[token][network];
        if (!contractAddress) throw new Error(`Unsupported token: ${token}`);
        const contract = await rateLimiter.executeWithQueue(
            async () => await tronWeb.contract().at(contractAddress)
        );

        const decimals = token === "USDT" ? 6 : await rateLimiter.executeWithQueue(
            async () => await contract.decimals().call()
        );
        const tokenAmount = tronWeb.toBigNumber(amount)
            .times(tronWeb.toBigNumber(10).pow(decimals))
            .toFixed(0);

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
            } else if (simulation.energy_used === undefined) {
                throw new Error("Failed to estimate energy");
            }
            const energy_used = simulation.energy_used;
            return { energy_used };
        } else {
            const txWrapper = await rateLimiter.executeWithQueue(
                async () => await tronWeb.transactionBuilder.triggerSmartContract(
                    contractAddress,
                    'transfer(address,uint256)',
                    {
                        feeLimit: 50_000_000,
                        callValue: 0,
                    },
                    [
                        { type: 'address', value: toAddress },
                        { type: 'uint256', value: tokenAmount }
                    ],
                    fromAddress
                )
            );

            if (!txWrapper.result?.result) {
                throw new Error(txWrapper.result?.message || "Failed to build transaction");
            }
            return { unsignedTx: txWrapper.transaction };
        }
    }

    // Check allowance for batch sender contract
    checkAllowance = async (payload: {
        network: Network,
        fromAddress: string,
        token: string
    }): Promise<{ allowanceStr: string }> => {
        const { network, fromAddress, token } = payload;

        const tronWeb = this.getInstance(network);
        tronWeb.setAddress(fromAddress);
        const spenderAddress = TronService.ADDRESS_MAP["BATCH_SENDER_CONTRACT"][network];
        if (!spenderAddress) throw new Error("Batch sender contract address not configured for this network");

        const contract = await rateLimiter.executeWithQueue(
            async () => await tronWeb.contract().at(TronService.ADDRESS_MAP[token][network])
        );

        const allowance = await rateLimiter.executeWithQueue(
            async () => await contract.allowance(fromAddress, spenderAddress).call()
        );

        return { allowanceStr: tronWeb.toBigNumber(allowance).toFixed(0) }; // Return as string to avoid precision loss
    }

    // Build approvement transaction for batch sender contract to spend user's tokens
    buildApprovement = async (payload: {
        network: Network,
        fromAddress: string,
        token: string,
        amount: string // Need to be string
    }): Promise<{ unsignedTx: Transaction }> => {
        const { network, fromAddress, token, amount } = payload;

        if (token !== "USDT") throw new Error(`Token ${token} is not supported for approvement.`);

        const tronWeb = this.getInstance(network);
        const tokenAddress = TronService.ADDRESS_MAP[token][network];
        const spenderAddr = TronService.ADDRESS_MAP["BATCH_SENDER_CONTRACT"][network];

        const txObject = await rateLimiter.executeWithQueue(
            async () => await tronWeb.transactionBuilder.triggerSmartContract(
                tokenAddress,
                'approve(address,uint256)',
                { feeLimit: 500_000_000, callValue: 0 },
                [
                    { type: 'address', value: spenderAddr },
                    { type: 'uint256', value: amount }
                ],
                fromAddress
            )
        );

        if (txObject.result?.result !== true) {
            throw new Error(txObject.result?.message || "Failed to build transfer approvement");
        }
        return { unsignedTx: txObject.transaction };
    }

    // Transfer TRC20 tokens to multiple recipients in batch (Sign in frontend)
    buildBatchTransfer = async (payload: {
        network: Network,
        fromAddress: string,
        token: string,
        recipients: { toAddress: string, amount: number }[],
        simulateOnly?: boolean
    }): Promise<{ energy_used: number } | { unsignedTx: Transaction }> => {
        const { network, fromAddress, token = "USDT", recipients, simulateOnly = false } = payload;

        // 1. Pre-check
        if (recipients.length <= 0) throw new Error("No recipients provided");
        if (token !== "USDT") throw new Error(`Token ${token} is not supported.`); // *** Only USDT supported for batch transfer ***
        const decimals = 6; // USDT decimals

        const tronWeb = this.getInstance(network);
        const tokenAddr = TronService.ADDRESS_MAP[token][network];
        const batchAddr = TronService.ADDRESS_MAP["BATCH_SENDER_CONTRACT"][network];
        if (!tokenAddr || !batchAddr) throw new Error("Contracts configuration missing");

        // 2. Prepare batch transfer data
        const toAddresses = recipients.map(r => r.toAddress);
        const tokenAmountStr = recipients.map(r => tronWeb.toBigNumber(r.amount).times(tronWeb.toBigNumber(10).pow(decimals)).toFixed(0));

        if (simulateOnly) {
            // 3A. Simulate batch transfer
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
            } else if (simulation.energy_used === undefined) {
                throw new Error("Failed to estimate energy");
            }
            const energy_used = simulation.energy_used;
            return { energy_used };
        } else {
            // 3B. Execute batch transfer
            const txObject = await tronWeb.transactionBuilder.triggerSmartContract(
                batchAddr,
                'multisendToken(address,address[],uint256[])',
                { feeLimit: 500_000_000, callValue: 0 },
                [
                    { type: 'address', value: tokenAddr },
                    { type: 'address[]', value: toAddresses },
                    { type: 'uint256[]', value: tokenAmountStr }
                ],
                fromAddress
            );
            if (txObject.result?.result !== true) {
                throw new Error(txObject.result?.message || "Failed to build batch transfer transaction");
            }
            const unsignedTx = txObject.transaction;
            return { unsignedTx };
        }
    }
}

const tronService = new TronService();
export default tronService;