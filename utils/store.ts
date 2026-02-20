import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from "sonner";
import { Network } from '@/models/network';
import { TronGridTrc20Transaction } from '@/models/tronResponse';

import { api } from './api';
import { pollEnergy } from './pollEnergy';
import { BatchTransferData, SingleTransferData } from '@/models/transfer';
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapters';
import TronFrontendService from '@/services/frontend/tronService';
import tronService from '@/services/tronService';

type ProcessStage = '' | 'idle' | 'estimating-energy' | 'renting-energy' | 'broadcasting' | 'confirming' | 'confirmed' | 'failed' | 'timeout' | 'energy-timeout';

type SenderStates = {
    adapter: TronLinkAdapter | null;

    pollInterval: NodeJS.Timeout | null;
    network: Network;
    address: string;
    privateKey: string;
    active: { address: boolean; privateKey: boolean; }
    profile: { trx?: number, usdt?: number, energy?: number, bandwidth?: number };
    isLoading: boolean;
};

type SenderActions = {
    connectAdapter: (adapter: TronLinkAdapter) => Promise<void>;
    disconnectAdapter: () => void;

    setNetwork: (network: Network) => void;
    setAddress: (address: string) => void;
    setPrivateKey: (privateKey: string) => void;
    updateActive: (update: Partial<{ address: boolean; privateKey: boolean }>) => void;
    setProfile: (profile: { trx?: number, usdt?: number, energy?: number, bandwidth?: number }) => void;

    validateAddress: () => Promise<boolean>;
    validatePrivateKey: (privateKey: string) => Promise<boolean>;
    fetchProfile: () => Promise<void>;
    startPolling: (intervalMs?: number) => void;
    stopPolling: () => void;

    reset: () => void;
}

export const useSenderStore = create<SenderStates & SenderActions>()(
    persist(
        (set, get) => ({
            adapter: null,
            connectAdapter: async (adapter) => {
                if (adapter.readyState !== "Found" || !adapter.address) {
                    toast.warning("Adapter not found or address not available");
                    return;
                }
                set({
                    adapter,
                    address: adapter.address || "",
                    active: { address: !!adapter.address, privateKey: !!adapter.address }
                });
                toast.success(`Connected to ${adapter.name}`);
            },
            disconnectAdapter: () => {
                set({
                    adapter: null,
                    address: "",
                    active: { address: false, privateKey: false }
                });
            },

            pollInterval: null,
            network: "mainnet",
            address: "",
            privateKey: "",
            active: { address: false, privateKey: false },
            profile: { trx: undefined, usdt: undefined, energy: undefined, bandwidth: undefined },
            isLoading: false,
            isFetchingProfile: false,

            setNetwork: (network) => set({ network }),
            setAddress: (address) => set({ address }),
            setPrivateKey: (privateKey) => set({ privateKey }),
            setProfile: (profile) => set({ profile }),

            updateActive: (update) => {
                const { fetchProfile, setProfile, startPolling, stopPolling } = get();
                set((state) => ({
                    active: {
                        ...state.active,
                        ...update,
                    },
                }))
                if (update.address !== undefined) {
                    update.address === true
                        ? fetchProfile()
                        : setProfile({ trx: undefined, usdt: undefined, energy: undefined, bandwidth: undefined });
                }
                if (update.privateKey !== undefined) {
                    update.privateKey === true
                        ? startPolling()
                        : stopPolling();
                }
            },

            validateAddress: async (): Promise<boolean> => {
                try {
                    set({ isLoading: true });
                    const { address } = get();
                    const result = await api(`/api/validation/address`, { address });
                    if (!result) {
                        toast.warning("Invalid TRON address");
                        return false;
                    }
                    return !!result;
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
                    const result = await api(`/api/validation/private-key`, { addressActivated: active.address, address, privateKey });
                    if (!result) {
                        toast.warning("Private key not matched");
                        return false;
                    }
                    return !!result;
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
                    const result: { trx?: number; usdt?: number; energy?: number; bandwidth?: number } = await api(`/api/profile`, { network, address, addressActivated: active.address });
                    const { trx, usdt, energy, bandwidth } = result || {};
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
                        if (active.address && active.privateKey && address) {
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
                network: state.network,
                profile: state.profile,
            }),
        }
    )
);

type OperationStates = {
    isLoading: boolean;
    transferRecords: TronGridTrc20Transaction[];

    processStage: { single: ProcessStage, batch: ProcessStage };
    energyRental: {
        enable: boolean,
        targetTier?: number,
        isMonitoring: boolean,
        txid?: string,
    };

    singleTransferData: Partial<SingleTransferData>;
    batchTransfers: Partial<BatchTransferData>;
}

type OperationActions = {
    setLoading: (isLoading: boolean) => void;
    setEnergyRental: (updates: Partial<OperationStates["energyRental"]>) => void;

    // Single transfer
    updateSingleTransfer: (updates: Partial<SingleTransferData>) => void;
    singlePreCheck: () => Promise<boolean>;
    simulateSingleTransfer: () => Promise<void>;
    singleTransferFlow: () => Promise<void>;

    // Batch transfer
    setBatchTransfers: (items: Partial<BatchTransferData>) => void;
    updateBatchTransfers: (updates: Partial<BatchTransferData>) => void;
    batchPreCheck: () => Promise<boolean>;
    simulateBatchTransfer: () => Promise<void>;
    batchTransferFlow: () => Promise<void>;

    clearSingleTransfer: () => void;
    clearBatchTransfers: () => void;
    clearProcessStage: (type: "single" | "batch") => void;
    clearEnergyRental: () => void;
    clearTransferRecords: () => void;

    isSingleTransfering: () => boolean;
    isBatchTransfering: () => boolean;
    resumeTransferMonitoring: (manual?: boolean) => Promise<void>;
    resumeBatchTransferMonitoring: (manual?: boolean) => Promise<void>;

    validateAddress: (address: string) => Promise<boolean>;
    fetchTransferRecords: (payload: { network?: Network, address: string }) => Promise<void>;
}

export const useOperationStore = create<OperationStates & OperationActions>()(
    persist(
        (set, get) => ({
            isLoading: false,
            transferRecords: [],
            clearTransferRecords: () => set({ transferRecords: [] }),

            processStage: { single: '', batch: '' },
            energyRental: { enable: false, isMonitoring: false },
            singleTransferData: { status: "idle", amount: 0, token: 'TRX', toAddress: "", txid: undefined, error: undefined },
            batchTransfers: { status: "idle", token: 'USDT', txid: undefined, error: undefined, data: [] },

            setLoading: (isLoading) => set({ isLoading }),
            setEnergyRental: (updates) => set(state => ({ energyRental: { ...state.energyRental, ...updates } })),

            updateSingleTransfer: (updates) => set(state => ({ singleTransferData: { ...state.singleTransferData, ...updates } })),
            clearSingleTransfer: () => set({ singleTransferData: { status: "idle", amount: 0, token: 'TRX', toAddress: "", txid: undefined, error: undefined } }),

            setBatchTransfers: (items) => set({ batchTransfers: items }),
            updateBatchTransfers: (updates) => set(state => ({ batchTransfers: { ...state.batchTransfers, ...updates } })),
            clearBatchTransfers: () => set({ batchTransfers: { status: "idle", token: 'USDT', txid: undefined, error: undefined, data: [] } }),

            isSingleTransfering: () => {
                const { status } = get().singleTransferData;
                return status === 'pending' || status === 'broadcasted';
            },
            isBatchTransfering: () => {
                const { status } = get().batchTransfers;
                return status === 'pending' || status === 'broadcasted';
            },

            clearProcessStage: (type) => set(state => ({ processStage: { ...state.processStage, [type]: '' } })),
            clearEnergyRental: () => set(state => ({ energyRental: { ...state.energyRental, isMonitoring: false, txid: undefined, targetTier: undefined } })),

            singlePreCheck: async (): Promise<boolean> => {
                const state = get();
                const sender = useSenderStore.getState();
                const { singleTransferData: req, updateSingleTransfer } = state;
                let pass = true;

                if (!sender.active.address || !sender.active.privateKey) {
                    toast.warning("Activate account first");
                    pass = false;
                }
                if (!sender.address || !req.toAddress || !req.amount || Number.isNaN(req.amount) || req.amount! <= 0) {
                    toast.warning("Missing required fields");
                    pass = false;
                }
                if (req.status === 'pending') {
                    toast.warning("Transfer is already in progress");
                    pass = false;
                }
                if (!await await api(`/api/validation/address`, { address: req.toAddress || "" })) pass = false;

                if (!pass) {
                    updateSingleTransfer({ status: "idle" });
                    set({ isLoading: false });
                }
                return pass;
            },

            simulateSingleTransfer: async () => {
                const state = get();
                const sender = useSenderStore.getState();
                const { singlePreCheck, updateSingleTransfer, energyRental, clearEnergyRental } = state;

                // 1. Pre-check
                const preCheckPass = await singlePreCheck();
                if (!preCheckPass) return;

                try {
                    set({ isLoading: true });
                    // 2: Update Context
                    updateSingleTransfer({
                        network: sender.network,
                        fromAddress: sender.address,
                        status: "idle",
                        txid: undefined,
                        error: undefined,
                    });
                    clearEnergyRental();

                    // 3: Simulate transfer
                    set({ processStage: { ...get().processStage, single: 'estimating-energy' } });
                    const result = await api<{ energy_used: number }>('/api/transfer/single', {
                        network: get().singleTransferData.network,
                        fromAddress: get().singleTransferData.fromAddress,
                        toAddress: get().singleTransferData.toAddress,
                        token: get().singleTransferData.token,
                        amount: get().singleTransferData.amount,
                        simulateOnly: true,
                    });

                    const requireEnergy = result.energy_used;
                    if (requireEnergy === 0) {
                        toast.success("Estimated energy cost is negligible. No rental needed");
                    }
                    set({
                        processStage: { ...get().processStage, single: "idle" },
                        energyRental: { ...energyRental, targetTier: requireEnergy }
                    });
                } catch (error) {
                    const message = (error as Error).message;
                    set({
                        processStage: { ...get().processStage, single: "idle" },
                        energyRental: { ...energyRental, targetTier: undefined }
                    });
                    toast.error(message);
                } finally {
                    set({ isLoading: false });
                }
            },

            singleTransferFlow: async () => {
                const state = get();
                const sender = useSenderStore.getState();
                const { singlePreCheck, updateSingleTransfer, energyRental } = state;

                // 1. Pre-check
                const preCheckPass = await singlePreCheck();
                if (!preCheckPass) return;

                try {
                    set({ isLoading: true });
                    const mode = sender.adapter ? "adapter" : "privateKey";
                    const tron = new TronFrontendService(mode, { network: get().singleTransferData.network as Network, privateKey: sender.privateKey });

                    // 2: Rent energy
                    if (energyRental.enable && energyRental.targetTier === undefined) {
                        toast.warning("Please simulate transfer first to estimate energy.");
                        return;
                    }
                    if (energyRental.enable && energyRental.targetTier && energyRental.targetTier > 0) {
                        set({ processStage: { ...get().processStage, single: 'renting-energy' } });
                        const rental = await tron.rentEnergy({
                            network: get().singleTransferData.network as Network,
                            address: get().singleTransferData.fromAddress || "",
                            energyReq: energyRental.targetTier,
                        });

                        if (!rental.skip) {
                            const success = await pollEnergy({ requiredEnergy: energyRental.targetTier });
                            if (!success) {
                                set({ processStage: { ...get().processStage, single: 'energy-timeout' } });
                                get().updateSingleTransfer({ status: 'timeout' });
                                toast.error("Energy rental timed out.");
                                return;
                            }
                        }
                    }

                    // 3: Broadcast
                    set({ processStage: { ...get().processStage, single: 'broadcasting' } });
                    updateSingleTransfer({ status: 'pending' });

                    const { txid } = await tron.singleTransfer({
                        network: get().singleTransferData.network as Network,
                        toAddress: get().singleTransferData.toAddress || "",
                        token: get().singleTransferData.token || "",
                        amount: get().singleTransferData.amount || 0
                    });

                    set({ processStage: { ...get().processStage, single: 'confirming' } });
                    updateSingleTransfer({ txid, status: 'broadcasted' });

                    const txConfirmed = await tron.pollTx(txid);
                    if (!txConfirmed) {
                        set({ processStage: { ...get().processStage, single: 'timeout' } });
                        updateSingleTransfer({ status: 'timeout' });
                        toast.warning("Transaction confirmation timed out");
                        return;
                    }

                    set({ processStage: { ...get().processStage, single: 'confirmed' } });
                    updateSingleTransfer({ status: 'confirmed' });
                } catch (error) {
                    const message = (error as Error).message;
                    set({ processStage: { ...get().processStage, single: 'failed' } });
                    updateSingleTransfer({ status: 'failed', error: message });
                    toast.error(message);
                } finally {
                    set({ isLoading: false });
                }
            },

            batchPreCheck: async (): Promise<boolean> => {
                const state = get();
                const sender = useSenderStore.getState();
                const { batchTransfers: req, updateBatchTransfers } = state;
                let pass = true;

                if (!sender.active.address || !sender.active.privateKey) {
                    toast.warning("Activate account first");
                    pass = false;
                }
                if (!req.data || req.data.length === 0) {
                    toast.warning("No valid transfer entry found");
                    pass = false;
                }
                if (req.status === 'pending') {
                    toast.warning("Transfer is already in progress");
                    pass = false;
                }
                for (const item of req.data || []) {
                    if (item.warning) {
                        toast.warning(`Invalid entry: ${item.warning}`);
                        pass = false;
                    }
                }
                if (!pass) {
                    set({ isLoading: false });
                    updateBatchTransfers({ status: "idle" });
                }
                return pass;
            },
            simulateBatchTransfer: async () => {
                const state = get();
                const sender = useSenderStore.getState();
                const { batchPreCheck, updateBatchTransfers, energyRental, clearEnergyRental } = state;

                // 1. Pre-check
                const preCheckPass = await batchPreCheck();
                if (!preCheckPass) return;

                try {
                    set({ isLoading: true });
                    // 2: Update Context
                    updateBatchTransfers({
                        network: sender.network,
                        fromAddress: sender.address,
                        token: get().batchTransfers.token,
                        status: "idle",
                        txid: undefined,
                        error: undefined,
                    });
                    clearEnergyRental();

                    // 3: Simulate transfer
                    set({ processStage: { ...get().processStage, batch: 'estimating-energy' } });
                    const result = await api<{ energy_used: number }>('/api/transfer/batch', {
                        network: get().batchTransfers.network,
                        fromAddress: get().batchTransfers.fromAddress,
                        token: get().batchTransfers.token,
                        recipients: get().batchTransfers.data || [],
                        simulateOnly: true,
                    });

                    console.log("Batch transfer simulation result:", result);
                    const requireEnergy = result.energy_used;
                    if (requireEnergy === 0) {
                        toast.success("Estimated energy cost is negligible. No rental needed");
                    }
                    set({
                        processStage: { ...get().processStage, batch: "idle" },
                        energyRental: { ...energyRental, targetTier: requireEnergy ?? undefined }
                    });
                } catch (error) {
                    const message = (error as Error).message;
                    set({
                        processStage: { ...get().processStage, batch: "idle" },
                        energyRental: { ...energyRental, targetTier: undefined }
                    });
                    toast.error(message);
                } finally {
                    set({ isLoading: false });
                }
            },
            batchTransferFlow: async () => {
                const state = get();
                const sender = useSenderStore.getState();
                const { batchPreCheck, updateBatchTransfers, energyRental } = state;

                // 1. Pre-check
                const preCheckPass = await batchPreCheck();
                if (!preCheckPass) return;

                try {
                    set({ isLoading: true });
                    const mode = sender.adapter ? "adapter" : "privateKey";
                    const tron = new TronFrontendService(mode, { network: get().singleTransferData.network as Network, privateKey: sender.privateKey });
                    // 2: Rent energy
                    if (energyRental.enable && energyRental.targetTier === undefined) {
                        toast.warning("Please simulate transfer first to estimate energy.");
                        return;
                    }
                    if (energyRental.enable && energyRental.targetTier && energyRental.targetTier > 0) {
                        set({ processStage: { ...get().processStage, batch: 'renting-energy' } });
                        const rental = await tron.rentEnergy({
                            network: get().singleTransferData.network as Network,
                            address: get().singleTransferData.fromAddress || "",
                            energyReq: energyRental.targetTier,
                        });

                        if (!rental.skip) {
                            const success = await pollEnergy({ requiredEnergy: energyRental.targetTier });
                            if (!success) {
                                set({ processStage: { ...get().processStage, batch: 'energy-timeout' } });
                                updateBatchTransfers({ status: 'timeout' });
                                toast.error("Energy rental timed out.");
                                return;
                            }
                        }
                    }

                    set({ processStage: { ...get().processStage, batch: 'broadcasting' } });
                    updateBatchTransfers({
                        status: 'pending',
                        network: sender.network,
                        txid: undefined,
                        error: undefined,
                    });
                    const approval = await tron.approveBatchTransfer({
                        network: get().batchTransfers.network as Network,
                        token: get().batchTransfers.token || "",
                        recipients: get().batchTransfers.data || []
                    })
                    if (!approval.sufficient && !approval.txid) {
                        throw new Error("Insufficient allowance and failed to approve");
                    }
                    const { txid } = await tron.batchTransfer({
                        network: get().batchTransfers.network as Network,
                        token: get().batchTransfers.token || "",
                        recipients: get().batchTransfers.data || []
                    });

                    set({ processStage: { ...get().processStage, batch: 'confirming' } });
                    updateBatchTransfers({ txid, status: 'broadcasted' });

                    const txConfirmed = await tron.pollTx(txid);
                    if (!txConfirmed) {
                        set({ processStage: { ...get().processStage, batch: 'timeout' } });
                        updateBatchTransfers({ status: 'timeout' });
                        toast.warning("Transaction confirmation timed out");
                        return;
                    }

                    set({ processStage: { ...get().processStage, batch: 'confirmed' } });
                    updateBatchTransfers({ status: 'confirmed' });

                } catch (error) {
                    const message = (error as Error).message;
                    set({ processStage: { ...get().processStage, batch: 'failed' } });
                    updateBatchTransfers({ status: 'failed', error: message });
                    toast.error(message);
                } finally {
                    set({ isLoading: false });
                }
            },

            resumeTransferMonitoring: async (manual: boolean = false) => {
                const state = get();
                const sender = useSenderStore.getState();
                const { processStage, energyRental, singleTransferData, updateSingleTransfer, isSingleTransfering, isLoading } = state;

                // 1. Pre-check
                if (sender.active.address && !!singleTransferData.fromAddress && sender.address !== singleTransferData.fromAddress) {
                    toast.info("Cleared tasks from previous account.");
                    state.clearSingleTransfer();
                    state.clearProcessStage("single");
                    state.clearEnergyRental();
                    return;
                }

                const canResumeEnergyMonitoring = processStage.single === "renting-energy"
                    && !!energyRental.txid
                    && !!isSingleTransfering();
                const canResumeTransferMonitoring = (
                    singleTransferData.status === 'pending'
                    || singleTransferData.status === 'broadcasted'
                    || singleTransferData.status === 'timeout'
                ) && !!singleTransferData.txid
                    && !!isSingleTransfering();

                if (!canResumeTransferMonitoring && !canResumeEnergyMonitoring) {
                    if (manual) toast.info("No interrupted task found to resume.")
                    return;
                }

                if (isLoading) return;
                set({ isLoading: true });
                try {
                    // 2A: Energy
                    if (canResumeEnergyMonitoring) {
                        toast.info("Resuming energy rental monitoring...");
                        set({ processStage: { ...get().processStage, single: 'renting-energy' } });
                        const success = await pollEnergy({ requiredEnergy: energyRental.targetTier || 0 });
                        if (!success) {
                            set({ processStage: { ...get().processStage, single: 'energy-timeout' } });
                            updateSingleTransfer({ status: 'timeout' });
                            toast.warning("Energy rental timed out.");
                        } else {
                            set({
                                energyRental: { ...energyRental, txid: undefined, isMonitoring: false },
                                processStage: { ...get().processStage, single: '' },
                                singleTransferData: { status: "idle", txid: undefined, error: undefined }
                            });
                            toast.success("Energy acquired! Please submit Transfer again immediately.");
                        }
                        return;
                    }
                    // 2B: Transfer
                    else if (canResumeTransferMonitoring) {
                        set({ processStage: { ...get().processStage, single: 'confirming' } });
                        toast.info("Resuming transaction confirmation monitoring...");
                        const mode = sender.adapter ? "adapter" : "privateKey";
                        const tron = new TronFrontendService(mode, { network: singleTransferData.network as Network, privateKey: sender.privateKey });
                        const txConfirmed = await tron.pollTx(singleTransferData.txid!);
                        if (!txConfirmed) {
                            set({ processStage: { ...get().processStage, single: 'timeout' } });
                            updateSingleTransfer({ status: 'timeout' });
                            toast.warning("Transaction confirmation timed out");
                            return;
                        }
                        set({ processStage: { ...get().processStage, single: 'confirmed' } });
                        updateSingleTransfer({ status: 'confirmed' });
                    }
                } catch (error) {
                    const message = (error as Error).message;
                    set({ processStage: { ...get().processStage, single: 'failed' } });
                    updateSingleTransfer({ status: 'failed', error: message });
                    toast.error(message);
                } finally {
                    set({ isLoading: false });
                }
            },

            resumeBatchTransferMonitoring: async (manual: boolean = false) => {
                const state = get();
                const sender = useSenderStore.getState();
                const { batchTransfers, updateBatchTransfers, processStage, energyRental, isBatchTransfering, isLoading } = state;

                if (sender.active.address && !!batchTransfers.fromAddress && sender.address !== batchTransfers.fromAddress) {
                    toast.info("Cleared tasks from previous account.");
                    state.clearBatchTransfers();
                    state.clearProcessStage("batch");
                    state.clearEnergyRental();
                    return;
                }

                const canResumeEnergyMonitoring = processStage.batch === "renting-energy"
                    && !!energyRental.txid
                    && !!isBatchTransfering();
                const canResumeTransferMonitoring = (
                    batchTransfers.status === 'pending'
                    || batchTransfers.status === 'broadcasted'
                    || batchTransfers.status === 'timeout'
                ) && !!batchTransfers.txid
                    && !!isBatchTransfering();

                if (!canResumeTransferMonitoring && !canResumeEnergyMonitoring) {
                    if (manual) toast.info("No interrupted task found to resume.")
                    return;
                }

                if (isLoading) return;
                set({ isLoading: true });
                try {
                    // 2A: Energy
                    if (canResumeEnergyMonitoring) {
                        toast.info("Resuming energy rental monitoring...");
                        set({ processStage: { ...get().processStage, batch: 'renting-energy' } });
                        const success = await pollEnergy({ requiredEnergy: energyRental.targetTier || 0 });
                        if (!success) {
                            set({ processStage: { ...get().processStage, batch: 'energy-timeout' } });
                            get().updateBatchTransfers({ status: 'timeout' });
                            toast.warning("Energy rental timed out.");
                        } else {
                            set({
                                energyRental: { ...energyRental, txid: undefined, isMonitoring: false },
                                processStage: { ...get().processStage, batch: '' },
                            });
                            updateBatchTransfers({ status: "idle", txid: undefined, error: undefined });
                            toast.success("Energy acquired! Please submit Transfer again immediately.");
                        }
                        return;
                    }
                    // 2B: Transfer
                    else if (canResumeTransferMonitoring) {
                        set({ processStage: { ...get().processStage, batch: 'confirming' } });
                        toast.info("Resuming transaction confirmation monitoring...");
                        const mode = sender.adapter ? "adapter" : "privateKey";
                        const tron = new TronFrontendService(mode, { network: batchTransfers.network as Network, privateKey: sender.privateKey });
                        const txConfirmed = await tron.pollTx(batchTransfers.txid!);
                        if (!txConfirmed) {
                            set({ processStage: { ...get().processStage, batch: 'timeout' } });
                            updateBatchTransfers({ status: 'timeout' });
                            toast.warning("Transaction confirmation timed out");
                            return;
                        }

                        set({ processStage: { ...get().processStage, batch: 'confirmed' } });
                        updateBatchTransfers({ status: 'confirmed' });
                    }
                } catch (error) {
                    const message = (error as Error).message;
                    set({ processStage: { ...get().processStage, batch: 'failed' } });
                    updateBatchTransfers({ status: 'failed', error: message });
                    toast.error(message);
                } finally {
                    set({ isLoading: false });
                }
            },

            validateAddress: async (address: string): Promise<boolean> => {
                try {
                    set({ isLoading: true });
                    const valid = await api<boolean>(`/api/validation/address`, { address });
                    return valid;
                } catch (error) {
                    throw error;
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
            processStage: state.processStage,
            energyRental: state.energyRental,
            singleTransferData: {
                ...state.singleTransferData,
                privateKey: ''
            },
            batchTransfers: {
                ...state.batchTransfers,
                privateKey: ""
            }
        }),
    }
    )
);