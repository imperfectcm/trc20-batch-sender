import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from "sonner";
import { Network } from '@/models/network';
import { TronGridTrc20Transaction } from '@/models/tronResponse';

import { api } from './api';
import { pollEnergy } from './pollEnergy';
import { pollTransaction } from './pollTransaction';
import { TransferItem, TransferStatus } from '@/models/transfer';

type ProcessStage = '' | 'standby' | 'estimating-energy' | 'renting-energy' | 'broadcasting' | 'confirming' | 'confirmed' | 'failed' | 'timeout' | 'energy-timeout';

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
    setNetwork: (network: Network) => void;
    setAddress: (address: string) => void;
    setPrivateKey: (privateKey: string) => void;
    setActive: (field: 'address' | 'privateKey', value: boolean) => void;
    setProfile: (profile: { trx?: number, usdt?: number, energy?: number, bandwidth?: number }) => void;
    validateAddress: (address: string) => Promise<boolean>;
    validatePrivateKey: (privateKey: string) => Promise<boolean>;
    fetchProfile: () => Promise<void>;
    startPolling: (intervalMs?: number) => void;
    stopPolling: () => void;
    reset: () => void;
}

export const useSenderStore = create<SenderStates & SenderActions>()(
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
            setNetwork: (network) => set((state) => ({ network })),
            setAddress: (address) => set((state) => ({ address })),
            setPrivateKey: (privateKey) => set((state) => ({ privateKey })),
            setActive: (field, value) => {
                set((state) => ({
                    active: {
                        ...state.active,
                        [field]: value,
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
            setProfile: (profile) => set((state) => ({ profile: profile })),
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
                if (!network || !address || !active.address) return;
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
            startPolling: (intervalMs = 15000) => {
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
            name: 'sd-store', // localStorage key
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                address: state.address,
                profile: state.profile,
            }),
        }
    )
);

type OperationStates = {
    isLoading: boolean;
    transferRecords: TronGridTrc20Transaction[];

    processStage: ProcessStage;
    energyRental: {
        enable: boolean,
        targetTier?: number,
        isMonitoring: boolean,
        txid?: string,
    };

    // Single transfer
    transferToken: string;
    singleTransferData: Partial<TransferItem>;

    batchTransfers: TransferItem[];
}

type OperationActions = {
    setLoading: (isLoading: boolean) => void;
    setEnergyRental: (updates: Partial<OperationStates['energyRental']>) => void;

    // Single transfer
    setTransferToken: (token: string) => void;
    updateSingleTransfer: (updates: Partial<TransferItem>) => void;
    singleTransferFlow: () => Promise<void>;
    clearSingleTransfer: () => void;

    // Batch transfer
    setBatchTransfers: (items: TransferItem[]) => void;
    updateBatchItemStatus: (id: string, status: TransferStatus, extra?: Partial<TransferItem>) => void;
    clearBatchTransfers: () => void;
    clearProcessStage: () => void;

    resumeTransferMonitoring: (manual?: boolean) => Promise<void>;

    validateAddress: (address: string) => Promise<boolean>;
    fetchTransferRecords: (payload: { network?: Network, address: string }) => Promise<void>;
}

export const useOperationStore = create<OperationStates & OperationActions>()(
    persist(
        (set, get) => ({
            isLoading: false,
            transferRecords: [],
            processStage: '',
            energyRental: { enable: false, isMonitoring: false },
            transferToken: 'TRX',
            singleTransferData: { status: 'standby', amount: 0, token: 'TRX', toAddress: "" },
            batchTransfers: [],

            setLoading: (isLoading) => set({ isLoading }),
            setEnergyRental: (updates) => set(state => ({ energyRental: { ...state.energyRental, ...updates } })),
            setTransferToken: (token) => set({ transferToken: token }),
            updateSingleTransfer: (updates) => set(state => ({ singleTransferData: { ...state.singleTransferData, ...updates } })),
            clearSingleTransfer: () => set({ singleTransferData: { status: 'standby', amount: 0, token: 'TRX', toAddress: "", error: undefined } }),
            setBatchTransfers: (items) => set({ batchTransfers: items }),
            updateBatchItemStatus: (id, status, extra = {}) => set(state => ({
                batchTransfers: state.batchTransfers.map(item =>
                    (item.txid === id) ? { ...item, status, ...extra } : item
                )
            })),
            clearBatchTransfers: () => set({ batchTransfers: [] }),
            clearProcessStage: () => set({ processStage: '' }),
            singleTransferFlow: async () => {
                const state = get();
                const sender = useSenderStore.getState();
                const { singleTransferData: req, transferToken } = state;

                // 1. Pre-check
                if (!sender.active.address || !sender.active.privateKey) {
                    toast.warning("Activate account first");
                    return;
                }
                if (req.status === 'pending') {
                    toast.warning("Transfer is already in progress");
                    return;
                }
                if (!await sender.validateAddress(req.toAddress || "")) return;

                set({ isLoading: true });

                try {
                    // Update Context
                    if (!req.toAddress || !req.amount || Number.isNaN(req.amount) || req.amount! <= 0) {
                        toast.warning("Missing required fields");
                        return;
                    }
                    get().updateSingleTransfer({
                        network: sender.network,
                        fromAddress: sender.address,
                        token: transferToken,
                        error: undefined,
                    });

                    // Stage 2: Energy
                    if (state.energyRental.enable) {
                        set({ processStage: 'estimating-energy' });
                        const requiredEnergy = await api<number>('/api/energy/estimation', {
                            network: get().singleTransferData.network,
                            fromAddress: get().singleTransferData.fromAddress,
                            toAddress: get().singleTransferData.toAddress,
                            token: get().singleTransferData.token,
                            amount: get().singleTransferData.amount,
                        });

                        if (requiredEnergy > 0) {
                            set({ processStage: 'renting-energy' });
                            const rental = await api<any>('/api/energy/rental', {
                                network: get().singleTransferData.network,
                                address: get().singleTransferData.fromAddress,
                                privateKey: sender.privateKey,
                                energy: requiredEnergy,
                            });

                            if (!rental.skip) {
                                const success = await pollEnergy({ requiredEnergy });
                                if (!success) {
                                    set({ processStage: 'energy-timeout' });
                                    get().updateSingleTransfer({ status: 'timeout' });
                                    toast.error("Energy rental timed out.");
                                    return;
                                }
                            }
                        }
                    }

                    // Stage 3: Broadcast
                    set({ processStage: 'broadcasting' });
                    get().updateSingleTransfer({ status: 'pending' });

                    const result = await api<{ txid: string }>('/api/transfer/single', {
                        network: get().singleTransferData.network,
                        fromAddress: get().singleTransferData.fromAddress,
                        toAddress: get().singleTransferData.toAddress,
                        token: get().singleTransferData.token,
                        amount: get().singleTransferData.amount,
                        privateKey: sender.privateKey,
                    });
                    const txid = result.txid;

                    set({ processStage: 'confirming' });
                    get().updateSingleTransfer({ txid, status: 'broadcasted' });

                    const txConfirmed = await pollTransaction({ txid, token: get().singleTransferData.token || "", network: get().singleTransferData.network as Network });
                    if (!txConfirmed) {
                        set({ processStage: 'timeout' });
                        get().updateSingleTransfer({ status: 'timeout' });
                        toast.warning("Transaction confirmation timed out");
                        return;
                    }

                    set({ processStage: 'confirmed' });
                    get().updateSingleTransfer({ status: 'confirmed' });
                } catch (error) {
                    const message = (error as Error).message;
                    set({ processStage: 'failed' });
                    get().updateSingleTransfer({ status: 'failed', error: message });
                    toast.error(message);
                } finally {
                    set({ isLoading: false });
                }
            },
            resumeTransferMonitoring: async (manual: boolean = false) => {
                const state = get();
                const { processStage, energyRental, singleTransferData } = state;

                const canResumeEnergyMonitoring = processStage === "renting-energy" && energyRental.txid;
                if (!manual
                    && singleTransferData.status !== 'pending'
                    && singleTransferData.status !== 'broadcasted'
                    && !canResumeEnergyMonitoring) {
                    return;
                }
                set({ isLoading: true });
                try {
                    if (canResumeEnergyMonitoring) {
                        toast.info("Resuming energy rental monitoring...");
                        const success = await pollEnergy({ requiredEnergy: energyRental.targetTier || 0 });
                        if (!success) {
                            set({ processStage: 'energy-timeout' });
                            get().updateSingleTransfer({ status: 'timeout' });
                            toast.error("Energy rental timed out.");
                        } else {
                            set({ processStage: '' });
                            get().updateSingleTransfer({ status: 'standby' });
                            toast.success("Energy acquired! Please click Transfer again.");
                        }
                        return;
                    }

                    set({ processStage: 'confirming' });
                    toast.info("Resuming transaction confirmation monitoring...");
                    const txConfirmed = await pollTransaction({ txid: singleTransferData.txid || "", token: singleTransferData.token || "", network: singleTransferData.network as Network });
                    if (!txConfirmed) {
                        set({ processStage: 'timeout' });
                        get().updateSingleTransfer({ status: 'timeout' });
                        toast.warning("Transaction confirmation timed out");
                        return;
                    }

                    set({ processStage: 'confirmed' });
                    get().updateSingleTransfer({ status: 'confirmed' });
                } catch (error) {
                    const message = (error as Error).message;
                    set({ processStage: 'failed' });
                    get().updateSingleTransfer({ status: 'failed', error: message });
                    toast.error(message);
                } finally {
                    set({ isLoading: false });
                }
            },
            validateAddress: async (address: string): Promise<boolean> => {
                try {
                    set({ isLoading: true });
                    const valid = await api<boolean>(`/api/validation/address`, { address });
                    if (!valid) {
                        toast.error("Invalid TRON address", { icon: '✘' });
                        return false;
                    } else {
                        toast.success("This is a valid TRON address", { icon: '✓' });
                        return valid;
                    };
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
                    const result = await api<TronGridTrc20Transaction[]>(`/api/transfer/record`, payload);
                    if (result.length === 0) toast.info("No transfer records found");
                    set({ transferRecords: result || [] });
                } catch (error) {
                    toast.error((error as Error).message || "Failed to fetch trc20 transfer records");
                } finally {
                    set({ isLoading: false });
                }
            },
        }), {
        name: 'op-store', // localStorage key
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
            transferToken: state.transferToken,
            processStage: state.processStage,
            energyRental: state.energyRental,
            singleTransferData: {
                ...state.singleTransferData,
                privateKey: ''
            },

            batchTransfers: state.batchTransfers,
        }),
    }
    )
);