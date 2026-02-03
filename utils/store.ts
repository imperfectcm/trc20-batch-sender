import { create, StoreApi, UseBoundStore } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from "sonner";
import { Network } from '@/models/network';
import { TronGridTrc20Transaction } from '@/models/tronResponse';
import { TransferReq, TransferRes } from '@/models/transfer';

type WithSelectors<S> = S extends { getState: () => infer T }
    ? S & { use: { [K in keyof T]: () => T[K] } }
    : never

export const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
    _store: S,
) => {
    const store = _store as WithSelectors<typeof _store>
    store.use = {}
    for (const k of Object.keys(store.getState())) {
        ; (store.use as any)[k] = () => store((s) => s[k as keyof typeof s])
    }
    return store
}

type SetStateAction<T> = T | ((prev: T) => T);

const resolveState = <T>(update: SetStateAction<T>, current: T): T => {
    return typeof update === 'function'
        ? (update as (prev: T) => T)(current)
        : update;
};

type SenderStates = {
    pollInterval: NodeJS.Timeout | null;
    network: Network;
    address: string;
    privateKey: string;
    active: { address: boolean; privateKey: boolean; }
    profile: { trx?: number, usdt?: number, energy?: number, bandwidth?: number };
    isLoading: boolean;
};

type SenderActions = {
    setNetwork: (network: SetStateAction<Network>) => void;
    setAddress: (address: SetStateAction<string>) => void;
    setPrivateKey: (privateKey: SetStateAction<string>) => void;
    setActive: (field: 'address' | 'privateKey', value: SetStateAction<boolean>) => void;
    setProfile: (profile: SetStateAction<{ trx?: number, usdt?: number, energy?: number, bandwidth?: number }>) => void;
    validateAddress: (address: string) => Promise<boolean>;
    validatePrivateKey: (privateKey: string) => Promise<boolean>;
    fetchProfile: () => Promise<void>;
    startPolling: (intervalMs?: number) => void;
    stopPolling: () => void;
    reset: () => void;
}

export const useSenderStore = createSelectors(
    create<SenderStates & SenderActions>()(
        persist(
            (set, get) => ({
                pollInterval: null,
                network: 'mainnet',
                address: "",
                privateKey: "",
                active: { address: false, privateKey: false },
                profile: { trx: undefined, usdt: undefined, energy: undefined, bandwidth: undefined },
                isLoading: false,
                isFetchingProfile: false,
                setNetwork: (network) =>
                    set((state) => ({
                        network: resolveState(network, state.network),
                    })),
                setAddress: (address) =>
                    set((state) => ({
                        address: resolveState(address, state.address),
                    })),
                setPrivateKey: (privateKey) =>
                    set((state) => ({
                        privateKey: resolveState(privateKey, state.privateKey),
                    })),
                setActive: (field, value) => {
                    set((state) => ({
                        active: {
                            ...state.active,
                            [field]: resolveState(value, state.active[field]),
                        },
                    }))
                    if (field === "address") {
                        if (value === true) {
                            get().fetchProfile();
                            get().startPolling();
                        } else {
                            get().setProfile({ trx: undefined, usdt: undefined, energy: undefined, bandwidth: undefined });
                            get().stopPolling();
                        }
                    }
                },
                setProfile: (profile) =>
                    set((state) => ({
                        profile: resolveState(profile, state.profile),
                    })),
                validateAddress: async (address: string): Promise<boolean> => {
                    try {
                        set({ isLoading: true });
                        const res = await fetch(`/api/validation/address`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ address }),
                        });
                        const result = await res.json();
                        if (!result.success) {
                            throw new Error(result.message || "Failed to validate address");
                        }
                        if (!result.data) {
                            toast.warning("Invalid TRON address");
                            return false;
                        }
                        return result.success;
                    } catch (error) {
                        toast.error((error as Error).message || "Failed to validate address");
                        return false;
                    } finally {
                        set({ isLoading: false });
                    }
                },
                validatePrivateKey: async (privateKey: string): Promise<boolean> => {
                    try {
                        const { address, active } = get();
                        set({ isLoading: true });
                        const res = await fetch(`/api/validation/private-key`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                addressActivated: active.address,
                                address,
                                privateKey
                            }),
                        });
                        const result = await res.json();
                        if (!result.success) {
                            throw new Error(result.message || "Failed to validate private key");
                        }
                        if (!result.data) {
                            toast.warning("Private key not matched");
                            return false;
                        }
                        return result.success;
                    } catch (error) {
                        toast.error((error as Error).message || "Failed to validate private key");
                        return false;
                    } finally {
                        set({ isLoading: false });
                    }
                },
                fetchProfile: async () => {
                    const { network, address, active } = get();
                    if (!address || !active.address) return;
                    try {
                        const res = await fetch(`/api/profile`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ network, address, addressActivated: active.address }),
                        });
                        const result: {
                            success: boolean,
                            message?: string,
                            data?: {
                                trx: number;
                                usdt: number;
                                energy: number;
                                bandwidth: number;
                            };
                        } = await res.json();
                        if (!result.success) {
                            throw new Error(result.message || "Failed to fetch profile");
                        }
                        const { trx, usdt, energy, bandwidth } = result.data || {};
                        set({ profile: { trx, usdt, energy, bandwidth } });
                    } catch (error) {
                        toast.error((error as Error).message || "Failed to fetch profile");
                    }
                },
                startPolling: (intervalMs = 10000) => {
                    const { pollInterval } = get();
                    if (pollInterval) return;

                    set({
                        pollInterval: setInterval(() => {
                            const { active, address } = get();
                            if (active.address && address) {
                                get().fetchProfile();
                            }
                        }, intervalMs)
                    })
                },
                stopPolling: () => {
                    const { pollInterval } = get();
                    if (pollInterval) {
                        clearInterval(pollInterval);
                        set({ pollInterval: null });
                    }
                },
                reset: () => {
                    set({
                        network: 'mainnet',
                        address: "",
                        privateKey: "",
                        active: { address: false, privateKey: false },
                        profile: { trx: undefined, usdt: undefined, energy: undefined, bandwidth: undefined },
                        isLoading: false,
                    });
                    get().stopPolling();
                },
            }),
            {
                name: 'trc20-batch-sender', // localStorage key
                storage: createJSONStorage(() => localStorage),
                partialize: (state) => ({
                    address: state.address,
                    profile: state.profile,
                }),
            }
        )
    )
);

type OperationStates = {
    isLoading: boolean;
    transferRecords: TronGridTrc20Transaction[];
    energyRental: {
        enable: boolean,
        targetTier?: number,
        isMonitoring: boolean,
        txID?: string,
    };

    // Single transfer
    transferToken: string;
    transferState: TransferReq & TransferRes;
    processStage: "estimating-energy" | "renting-energy" | "broadcasting" | "confirming" | "confirmed" | "failed" | "";

    batchTransferList: {
        standby: (TransferReq & TransferRes)[],
        pending: (TransferReq & TransferRes)[],
        broadcasted: (TransferReq & TransferRes)[],
        confirmed: (TransferReq & TransferRes)[],
        failed: (TransferReq & TransferRes)[]
    }
}

type OperationActions = {
    validateAddress: (address: string) => Promise<boolean>;
    fetchTransferRecords: (payload: { network?: Network, address: string }) => Promise<void>;
    setEnergyRental: (payload: SetStateAction<OperationStates['energyRental']>) => void;

    // Single transfer
    setTransferToken: (token: SetStateAction<string>) => void;
    setTransferState: (
        key: keyof (TransferReq & TransferRes),
        state: SetStateAction<(TransferReq & TransferRes)[keyof (TransferReq & TransferRes)]>
    ) => void;
    estimateEnergy: (payload: {
        network: Network,
        fromAddress: string,
        toAddress: string,
        token: string,
        amount: number,
    }) => Promise<number>;
    rentEnergy: (payload: {
        network: string,
        address: string,
        privateKey: string,
        targetTier: number,
    }) => Promise<{ success: boolean, data?: any, message?: string, skip?: boolean }>;
    checkTxID: (payload: { network?: Network, txID: string, token: string }) => Promise<{ success: boolean, data?: any, message?: string }>;

    singleTransfer: () => Promise<void>;

    // Batch transfer
    setBatchTransferList: (
        status: 'standby' | 'pending' | 'broadcasted' | 'confirmed' | 'failed',
        list: SetStateAction<(TransferReq & TransferRes)[]>
    ) => void;
    switchToPending: (item: TransferReq & TransferRes) => void;
    switchToBroadcasted: (item: TransferReq & TransferRes) => void;
    switchToConfirmed: (item: TransferReq & TransferRes) => void;
    switchToFailed: (item: TransferReq & TransferRes) => void;
    clearBatchTransferList: () => void;
}

export const useOperationStore = createSelectors(
    create<OperationStates & OperationActions>()(
        persist(
            (set, get) => ({
                isLoading: false,
                transferRecords: [],
                validateAddress: async (address: string): Promise<boolean> => {
                    try {
                        set({ isLoading: true });
                        const res = await fetch(`/api/validation/address`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ address }),
                        });
                        const result = await res.json();
                        if (!result.success) {
                            throw new Error(result.message || "Failed to validate address");
                        }
                        if (!result.data) {
                            toast.error("Invalid TRON address", { icon: '✘' });
                            return false;
                        }
                        toast.success("This is a valid TRON address", { icon: '✓' });
                        return result.success;
                    } catch (error) {
                        toast.error((error as Error).message || "Failed to validate address");
                        return false;
                    } finally {
                        set({ isLoading: false });
                    }
                },
                fetchTransferRecords: async (payload: { network?: Network, address: string }): Promise<void> => {
                    try {
                        set({ isLoading: true });
                        const res = await fetch(`/api/transfer/record`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(payload),
                        });
                        const result = await res.json();
                        if (!result.success) {
                            throw new Error(result.message || "Failed to fetch trc20 transfer records");
                        }
                        if (!result.data || result.data.length === 0) {
                            toast.info("No transfer records found");
                        }
                        set({ transferRecords: resolveState(result.data || [], get().transferRecords) });
                    } catch (error) {
                        toast.error((error as Error).message || "Failed to fetch trc20 transfer records");
                    } finally {
                        set({ isLoading: false });
                    }
                },
                energyRental: { enable: false, targetTier: undefined, isMonitoring: false },
                setEnergyRental: (payload) =>
                    set((state) => ({
                        energyRental: resolveState(payload, state.energyRental),
                    })),
                transferToken: 'TRX',
                setTransferToken: (token) =>
                    set((state) => ({
                        transferToken: resolveState(token, state.transferToken),
                    })),

                transferState: {
                    network: useSenderStore.getState().network,
                    privateKey: useSenderStore.getState().privateKey,
                    fromAddress: useSenderStore.getState().address,
                    toAddress: '',
                    token: 'TRX',
                    amount: 0,
                    status: 'standby',
                    txId: undefined,
                },
                setTransferState: (key, value) =>
                    set((state) => ({
                        transferState: {
                            ...state.transferState,
                            [key]: resolveState(value, state.transferState[key])
                        },
                    })),

                processStage: '',

                batchTransferList: { standby: [], pending: [], broadcasted: [], confirmed: [], failed: [] },
                setBatchTransferList: (status, list) =>
                    set((state) => ({
                        batchTransferList: {
                            ...state.batchTransferList,
                            [status]: resolveState(list, state.batchTransferList[status]),
                        },
                    })),
                switchToPending: (item) => {
                    set((state) => ({
                        batchTransferList: {
                            ...state.batchTransferList,
                            standby: state.batchTransferList.standby.filter(i => i !== item),
                            pending: [...state.batchTransferList.pending, item],
                        },
                    }));
                },
                switchToBroadcasted: (item) => {
                    set((state) => ({
                        batchTransferList: {
                            ...state.batchTransferList,
                            pending: state.batchTransferList.pending.filter(i => i !== item),
                            broadcasted: [...state.batchTransferList.broadcasted, item],
                        },
                    }));
                },
                switchToConfirmed: (item) => {
                    set((state) => ({
                        batchTransferList: {
                            ...state.batchTransferList,
                            broadcasted: state.batchTransferList.broadcasted.filter(i => i !== item),
                            confirmed: [...(state.batchTransferList as any).confirmed || [], item],
                        },
                    }));
                },
                switchToFailed: (item) => {
                    set((state) => ({
                        batchTransferList: {
                            ...state.batchTransferList,
                            pending: state.batchTransferList.pending.filter(i => i !== item),
                            failed: [...(state.batchTransferList as any).failed || [], item],
                        },
                    }));
                },
                estimateEnergy: async (payload: {
                    network: Network,
                    fromAddress: string,
                    toAddress: string,
                    token: string,
                    amount: number,
                }): Promise<number> => {
                    try {
                        const { network, fromAddress, toAddress, token, amount } = payload;
                        const res = await fetch(`/api/energy/estimation`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                network,
                                fromAddress,
                                toAddress,
                                token,
                                amount,
                            }),
                        });
                        const result: { success: boolean; message?: string; data?: number } = await res.json();

                        if (!result.success) throw new Error(result.message || "Failed to estimate energy");
                        return result.data || 0;
                    } catch (error) {
                        throw error;
                    }
                },
                rentEnergy: async (payload: {
                    network: string,
                    address: string,
                    privateKey: string,
                    targetTier: number,
                }): Promise<{ success: boolean, data?: any, message?: string, skip?: boolean }> => {
                    const { network, address, privateKey, targetTier } = payload;
                    const res = await fetch(`/api/energy/rental`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            network,
                            address,
                            privateKey,
                            targetTier,
                        }),
                    });
                    const result = await res.json();
                    return result;
                },
                checkTxID: async (payload: { network?: Network, txID: string, token: string }): Promise<{ success: boolean, data?: any, message?: string }> => {
                    try {
                        const { network, txID, token } = payload;
                        const res = await fetch(`/api/transfer/check`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                network,
                                txID,
                                token,
                            }),
                        });
                        const result: { success: boolean; message?: string; data?: any } = await res.json();

                        if (!result.success) throw new Error(result.message || "Failed to check transaction ID");
                        return result;
                    } catch (error) {
                        throw error;
                    }
                },
                singleTransfer: async (): Promise<void> => {
                    try {
                        set({ isLoading: true });
                        if (!useSenderStore.getState().active.address || !useSenderStore.getState().active.privateKey) {
                            toast.warning("Please activate and your address and private key first.");
                            return;
                        }
                        // Prevent multiple or duplicated transfers
                        if (get().transferState.status === "pending") {
                            toast.warning("Transfer is already in process.");
                            return;
                        }
                        get().setTransferState("token", get().transferToken);

                        // Stage 1: Check all parameters
                        const network = useSenderStore.getState().network;
                        const privateKey = useSenderStore.getState().privateKey;
                        const fromAddress = useSenderStore.getState().address;
                        const toAddress = get().transferState.toAddress;
                        const token = get().transferState.token;
                        const amount = get().transferState.amount;
                        if (!network || !fromAddress || !toAddress || !privateKey || !token || amount <= 0) {
                            toast.warning("Missing required fields");
                            return;
                        }
                        get().setTransferState("network", network);
                        get().setTransferState("fromAddress", fromAddress);
                        get().setTransferState("token", token);
                        get().setTransferState("status", "standby");

                        // Stage 2: Check energy rental if enabled, estimate energy
                        if (get().energyRental.enable) {
                            if (network !== "mainnet") {
                                toast.warning("Only mainnet is supported for energy auto renting");
                                return;
                            }
                            get().setTransferState("status", "pending");
                            set({ processStage: "estimating-energy" });
                            const requiredEnergy = await get().estimateEnergy({
                                network,
                                fromAddress,
                                toAddress,
                                token,
                                amount,
                            });
                            set({ energyRental: { ...get().energyRental, targetTier: requiredEnergy, isMonitoring: true } });

                            if (requiredEnergy > 0) {
                                // Stage 3: Rent energy
                                toast.info(`Estimated energy tier: ${requiredEnergy}. Starting energy rental...`);
                                get().setTransferState("status", "pending");
                                set({ processStage: "renting-energy" });

                                const rentalResult = await get().rentEnergy({
                                    network,
                                    address: fromAddress,
                                    privateKey,
                                    targetTier: requiredEnergy,
                                });
                                if (!rentalResult.success) throw new Error(rentalResult.message || "Failed to rent energy, try to turn off energy rental function and rent manually.");
                                if (rentalResult.skip) {
                                    toast.info("No need to rent energy, sufficient energy available.");
                                    set({ energyRental: { ...get().energyRental, isMonitoring: false } });
                                } else {
                                    // Stage 3.1: Polling profile energy until enough energy
                                    toast.info(rentalResult.message || "Energy rental submitted. Confirmation usually takes 20-60 seconds.");
                                    set({ energyRental: { ...get().energyRental, txID: rentalResult.data?.txID || "" } });
                                    let maxRetries = 36;
                                    const pollIntervalMs = 5000;
                                    await new Promise<void>((resolve, reject) => {
                                        const interval = setInterval(async () => {
                                            try {
                                                const profile = await useSenderStore.getState().profile;
                                                const energy = profile.energy || 0;

                                                if (energy >= requiredEnergy) {
                                                    toast.info("Sufficient energy acquired.");
                                                    set({ energyRental: { ...get().energyRental, isMonitoring: false } });
                                                    clearInterval(interval);
                                                    resolve();
                                                } else {
                                                    maxRetries--;
                                                    if (maxRetries <= 0) {
                                                        set({ energyRental: { ...get().energyRental, isMonitoring: false } });
                                                        clearInterval(interval);
                                                        reject(new Error("Energy rental timeout. Please try again."));
                                                    }
                                                }
                                            } catch (error) {
                                                set({ energyRental: { ...get().energyRental, isMonitoring: false } });
                                                clearInterval(interval);
                                                reject(error);
                                            }
                                        }, pollIntervalMs);
                                    })
                                }
                            } else {
                                toast.info("No need to rent energy, sufficient energy available.");
                            }
                        }

                        // Stage 4: Broadcast transfer transaction
                        get().setTransferState("status", "pending");
                        set({ processStage: "broadcasting" });
                        const transferRes = await fetch(`/api/transfer/single`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                network,
                                privateKey,
                                fromAddress,
                                toAddress,
                                token,
                                amount,
                            }),
                        });
                        const transferResult = await transferRes.json();
                        if (!transferResult.success) throw new Error(transferResult.message || "Failed to broadcast transfer transaction");
                        const txID = transferResult.data?.txid;
                        if (!txID) throw new Error("No transaction ID returned from transfer");

                        console.log("Transfer TXID:", txID);
                        get().setTransferState("txID", txID);
                        get().setTransferState("status", "broadcasted");
                        set({ processStage: "confirming", isLoading: false });
                        toast.info(`Transfer broadcasted. TXID: ${txID}. Waiting for confirmation...`);

                        // Stage 5: Confirm transaction
                        let confirmRetries = 18;
                        const confirmIntervalMs = 10000;
                        await new Promise<void>((resolve, reject) => {
                            const interval = setInterval(async () => {
                                try {
                                    const confirmResult = await get().checkTxID({ network, txID, token });
                                    if (!confirmResult.success) {
                                        throw new Error(confirmResult.message || "Failed to confirm transfer transaction");
                                    }
                                    const confirmed = confirmResult.data?.confirmed;
                                    if (confirmed) {
                                        get().setTransferState("status", "confirmed");
                                        set({ processStage: "confirmed" });
                                        toast.success(`Transfer confirmed! TXID: ${txID}`);
                                        clearInterval(interval);
                                        resolve();
                                    } else {
                                        confirmRetries--;
                                        if (confirmRetries <= 0) {
                                            clearInterval(interval);
                                            reject(new Error("Transaction confirmation timeout. Please check the transaction status manually."));
                                        }
                                    }
                                } catch (error) {
                                    clearInterval(interval);
                                    reject(error);
                                }
                            }, confirmIntervalMs);
                        });

                    } catch (error) {
                        get().setTransferState("status", "failed");
                        set({ processStage: "failed" });
                        toast.error((error as Error).message || "Transfer failed");
                        console.log(error)
                    } finally {
                        set({ isLoading: false });
                        return;
                    }
                },
                clearBatchTransferList: () => {
                    set({
                        batchTransferList: {
                            standby: [],
                            pending: [],
                            broadcasted: [],
                            confirmed: [],
                            failed: []
                        }
                    });
                }
            }), {
            name: 'trc20-batch-sender-operation', // localStorage key
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                transferToken: state.transferToken,
                energyRental: state.energyRental,
                transferState: {
                    ...state.transferState,
                    privateKey: ''
                },
                processStage: state.processStage,

                batchTransferList: state.batchTransferList,
            }),
        }
        )
    )
);