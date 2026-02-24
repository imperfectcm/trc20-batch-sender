import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from "sonner";
import { Network } from '@/models/network';
import { TronGridTrc20Transaction } from '@/models/tronResponse';

import { api } from './api';
import { pollEnergy } from './pollEnergy';
import { BatchTransferData, ProcessStage, SingleTransferData } from '@/models/transfer';
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapters';
import TronFrontendService from '@/services/frontend/tronService';

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
                const { updateActive } = get()
                set({
                    adapter,
                    address: adapter.address || ""
                });
                updateActive({ address: !!adapter.address, privateKey: !!adapter.address });
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
            startPolling: (intervalMs = 20000) => {
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
    updateProcess: (process: Partial<OperationStates["processStage"]>) => void;

    // Single transfer
    updateSingleTransfer: (updates: Partial<SingleTransferData>) => void;
    singlePreCheck: () => Promise<boolean>;
    simulateSingleTransfer: () => Promise<void>;
    singleTransferFlow: () => Promise<void>;

    // Batch transfer
    setBatchTransfers: (items: Partial<BatchTransferData>) => void;
    updateBatchTransfers: (updates: Partial<BatchTransferData>) => void;
    batchPreCheck: () => Promise<boolean>;
    approveBatchTransfer: () => Promise<boolean>;
    simulateBatchTransfer: () => Promise<void>;
    batchTransferFlow: () => Promise<void>;

    clearSingleTransfer: () => void;
    clearBatchTransfers: () => void;
    clearProcessStage: (type: "single" | "batch") => void;
    clearEnergyRental: () => void;
    clearTransferRecords: () => void;

    isTransferActive: (type: "single" | "batch") => boolean;
    isTransferPending: (type: "single" | "batch") => boolean;
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
            updateProcess: (process) => set(state => ({ processStage: { ...state.processStage, ...process } })),

            energyRental: { enable: false, isMonitoring: false },
            singleTransferData: { amount: 0, token: 'TRX', toAddress: "", txid: undefined, error: undefined },
            batchTransfers: { token: 'USDT', txid: undefined, error: undefined, data: [] },

            setLoading: (isLoading) => set({ isLoading }),
            setEnergyRental: (updates) => set(state => ({ energyRental: { ...state.energyRental, ...updates } })),

            updateSingleTransfer: (updates) => set(state => ({ singleTransferData: { ...state.singleTransferData, ...updates } })),
            clearSingleTransfer: () => set({ singleTransferData: { amount: 0, token: 'TRX', toAddress: "", txid: undefined, error: undefined } }),

            setBatchTransfers: (items) => set({ batchTransfers: items }),
            updateBatchTransfers: (updates) => set(state => ({ batchTransfers: { ...state.batchTransfers, ...updates } })),
            clearBatchTransfers: () => set({ batchTransfers: { token: 'USDT', txid: undefined, error: undefined, data: [] } }),

            isTransferActive: (type) => {
                const stage = get().processStage[type];
                return ["approving", "renting-energy", "broadcasting", "confirming"].includes(stage);
            },
            isTransferPending: (type: "single" | "batch") => {
                const stage = get().processStage[type];
                return ["approving", "estimating-energy", "renting-energy", "broadcasting", "confirming", "energy-timeout", "timeout"].includes(stage);
            },

            clearProcessStage: (type) => set(state => ({ processStage: { ...state.processStage, [type]: '' } })),
            clearEnergyRental: () => set(state => ({ energyRental: { ...state.energyRental, isMonitoring: false, txid: undefined, targetTier: undefined } })),

            singlePreCheck: async (): Promise<boolean> => {
                const { singleTransferData: req, isTransferPending } = get();
                const sender = useSenderStore.getState();
                let pass = true;

                if (isTransferPending("single") || isTransferPending("batch")) {
                    toast.warning("Transfer is already in progress");
                    return false;
                }
                if (!sender.active.address || !sender.active.privateKey) {
                    toast.warning("Activate account first");
                    pass = false;
                }
                if (!sender.address || !req.toAddress || !req.amount || Number.isNaN(req.amount) || req.amount! <= 0) {
                    toast.warning("Missing required fields");
                    pass = false;
                }
                if (!await await api(`/api/validation/address`, { address: req.toAddress || "" })) pass = false;

                if (!pass) { set({ isLoading: false }) };
                return pass;
            },

            simulateSingleTransfer: async () => {
                const { updateProcess, singlePreCheck, updateSingleTransfer, energyRental, clearEnergyRental } = get();
                const sender = useSenderStore.getState();

                // 1. Pre-check
                const preCheckPass = await singlePreCheck();
                if (!preCheckPass) return;

                try {
                    // 2: Update Context
                    set({ isLoading: true });
                    updateSingleTransfer({
                        network: sender.network,
                        fromAddress: sender.address,
                        txid: undefined,
                        error: undefined,
                    });
                    clearEnergyRental();

                    // 3: Simulate transfer
                    updateProcess({ single: 'estimating-energy' });
                    const { energy_used: requireEnergy } = await api<{ energy_used: number }>('/api/transfer/single', {
                        network: get().singleTransferData.network,
                        fromAddress: get().singleTransferData.fromAddress,
                        toAddress: get().singleTransferData.toAddress,
                        token: get().singleTransferData.token,
                        amount: get().singleTransferData.amount,
                        simulateOnly: true,
                    });

                    // 4. Set energy rental target
                    if (requireEnergy === 0) {
                        toast.success("Estimated energy cost is negligible. No rental needed");
                    }
                    set({ energyRental: { ...energyRental, targetTier: requireEnergy } });
                } catch (error) {
                    const message = (error as Error).message;
                    set({ energyRental: { ...energyRental, targetTier: undefined } });
                    toast.error(message);
                } finally {
                    updateProcess({ single: "idle" });
                    set({ isLoading: false });
                }
            },

            singleTransferFlow: async () => {
                const { updateProcess, singlePreCheck, updateSingleTransfer, energyRental } = get();
                const sender = useSenderStore.getState();

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
                        updateProcess({ single: 'renting-energy' });
                        const rental = await tron.rentEnergy({
                            network: get().singleTransferData.network as Network,
                            address: get().singleTransferData.fromAddress || "",
                            energyReq: energyRental.targetTier,
                        });

                        if (!rental.skip) {
                            const success = await pollEnergy({ requiredEnergy: energyRental.targetTier });
                            if (!success) {
                                updateProcess({ single: 'energy-timeout' });
                                toast.error("Energy rental timed out.");
                                return;
                            }
                        }
                    }

                    // 3: Broadcast
                    updateProcess({ single: 'broadcasting' });
                    updateSingleTransfer({
                        txid: undefined,
                        error: undefined
                    });
                    const { txid } = await tron.singleTransfer({
                        network: get().singleTransferData.network as Network,
                        toAddress: get().singleTransferData.toAddress || "",
                        token: get().singleTransferData.token || "",
                        amount: get().singleTransferData.amount || 0
                    });

                    // 4: Monitor
                    updateProcess({ single: 'confirming' });
                    updateSingleTransfer({ txid });
                    const txConfirmed = await tron.pollTx(txid);
                    if (!txConfirmed) {
                        updateProcess({ single: 'timeout' });
                        toast.warning("Transaction confirmation timed out");
                        return;
                    }

                    updateProcess({ single: 'confirmed' });
                } catch (error) {
                    const message = (error as Error).message;
                    updateProcess({ single: 'failed' });
                    updateSingleTransfer({ error: message });
                    toast.error(message);
                } finally {
                    set({ isLoading: false });
                }
            },

            batchPreCheck: async (): Promise<boolean> => {
                const { batchTransfers: req, isTransferPending } = get();
                const sender = useSenderStore.getState();
                let pass = true;

                if (isTransferPending("single") || isTransferPending("batch")) {
                    toast.warning("Transfer is already in progress");
                    return false;
                }
                if (!sender.active.address || !sender.active.privateKey) {
                    toast.warning("Activate account first");
                    pass = false;
                }
                if (!req.data || req.data.length === 0) {
                    toast.warning("No valid transfer entry found");
                    pass = false;
                }
                for (const item of req.data || []) {
                    if (item.warning) {
                        toast.warning(`Invalid entry: ${item.warning}`);
                        pass = false;
                    }
                }

                if (!pass) { set({ isLoading: false }) };
                return pass;
            },
            approveBatchTransfer: async (): Promise<boolean> => {
                const { updateProcess, batchPreCheck, updateBatchTransfers } = get();
                const sender = useSenderStore.getState();

                // 1. Pre-check
                const preCheckPass = await batchPreCheck();
                if (!preCheckPass) return false;

                try {
                    set({ isLoading: true });
                    const mode = sender.adapter ? "adapter" : "privateKey";
                    const tron = new TronFrontendService(mode, { network: sender.network as Network, privateKey: sender.privateKey });

                    // 2: Update Context
                    updateProcess({ batch: "idle" });
                    updateBatchTransfers({
                        network: sender.network,
                        fromAddress: sender.address,
                        token: get().batchTransfers.token,
                        txid: undefined,
                        error: undefined,
                    });

                    // 3. Check allowance and approve if needed
                    const allowance = await tron.checkAllowance({
                        network: get().batchTransfers.network as Network,
                        token: get().batchTransfers.token || "",
                        recipients: get().batchTransfers.data || [],
                    });
                    if (allowance.sufficient) {
                        return true; // No need to approve, proceed to transfer
                    }

                    // 4. UX for adapter approval
                    if (mode === "adapter") {
                        const totalAmount = get().batchTransfers.data?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
                        toast("Batch Transfer Approval", {
                            description: (
                                <div className="space-y-1 text-sm">
                                    <p>Spending cap required: <strong className='text-tangerine'>{totalAmount} USDT</strong></p>
                                    <p>Please enter this amount in the TronLink spending cap field to proceed.</p>
                                    <p className="text-muted-foreground">To avoid future approval fees, you may enter a larger amount (e.g. 1000000 USDT) to set a long-term spending limit.</p>
                                </div>
                            ),
                            duration: 10000,
                            position: "top-center",
                        });
                    }
                    const approval = await tron.approveBatchTransfer({
                        network: get().batchTransfers.network as Network,
                        token: get().batchTransfers.token || "",
                        totalAmount: allowance.totalAmount,
                    })
                    if (!approval.txid) {
                        throw new Error("Failed to approve transaction");
                    }

                    // 5. Monitor approval transaction
                    updateProcess({ batch: 'approving' });
                    updateBatchTransfers({ txid: approval.txid });
                    const txConfirmed = await tron.pollTx(approval.txid);
                    if (!txConfirmed) {
                        updateProcess({ batch: 'timeout' });
                        toast.warning("Transaction confirmation timed out");
                        return false;
                    }

                    updateProcess({ batch: 'idle' });
                    updateBatchTransfers({ txid: undefined });
                    return true;

                } catch (error) {
                    const message = (error as Error).message;
                    updateProcess({ batch: 'failed' });
                    updateBatchTransfers({ error: message });
                    toast.error(message);
                    return false;
                } finally {
                    set({ isLoading: false });
                }
            },
            simulateBatchTransfer: async () => {
                const { updateProcess, batchPreCheck, updateBatchTransfers, energyRental, clearEnergyRental } = get();
                const sender = useSenderStore.getState();

                // 1. Pre-check
                const preCheckPass = await batchPreCheck();
                if (!preCheckPass) return;

                try {
                    // 2: Update Context
                    set({ isLoading: true });
                    updateBatchTransfers({
                        network: sender.network,
                        fromAddress: sender.address,
                        token: get().batchTransfers.token,
                        txid: undefined,
                        error: undefined,
                    });
                    clearEnergyRental();

                    // 3: Simulate transfer
                    updateProcess({ batch: 'estimating-energy' });
                    const { energy_used: requireEnergy } = await api<{ energy_used: number }>('/api/transfer/batch', {
                        network: get().batchTransfers.network,
                        fromAddress: get().batchTransfers.fromAddress,
                        token: get().batchTransfers.token,
                        recipients: get().batchTransfers.data || [],
                        simulateOnly: true,
                    });

                    // 4: Set energy rental target
                    if (requireEnergy === 0) {
                        toast.success("Estimated energy cost is negligible. No rental needed");
                    }
                    set({ energyRental: { ...energyRental, targetTier: requireEnergy ?? undefined } });
                } catch (error) {
                    const message = (error as Error).message;
                    set({ energyRental: { ...energyRental, targetTier: undefined } });
                    toast.error(message);
                } finally {
                    updateProcess({ batch: "idle" });
                    set({ isLoading: false });
                }
            },
            batchTransferFlow: async () => {
                const { updateProcess, batchPreCheck, updateBatchTransfers, energyRental } = get();
                const sender = useSenderStore.getState();

                // 1. Pre-check
                const preCheckPass = await batchPreCheck();
                if (!preCheckPass) return;

                try {
                    set({ isLoading: true });
                    const mode = sender.adapter ? "adapter" : "privateKey";
                    const tron = new TronFrontendService(mode, { network: get().batchTransfers.network as Network, privateKey: sender.privateKey });

                    // 2: Rent energy
                    if (energyRental.enable && energyRental.targetTier === undefined) {
                        toast.warning("Please simulate transfer first to estimate energy.");
                        return;
                    }
                    if (energyRental.enable && energyRental.targetTier && energyRental.targetTier > 0) {
                        updateProcess({ batch: 'renting-energy' });
                        const rental = await tron.rentEnergy({
                            network: get().batchTransfers.network as Network,
                            address: get().batchTransfers.fromAddress || "",
                            energyReq: energyRental.targetTier,
                        });

                        if (!rental.skip) {
                            const success = await pollEnergy({ requiredEnergy: energyRental.targetTier });
                            if (!success) {
                                updateProcess({ batch: 'energy-timeout' });
                                toast.error("Energy rental timed out.");
                                return;
                            }
                        }
                    }

                    // 3: Broadcast
                    updateProcess({ batch: 'broadcasting' });
                    updateBatchTransfers({
                        txid: undefined,
                        error: undefined,
                    });
                    const { txid } = await tron.batchTransfer({
                        network: get().batchTransfers.network as Network,
                        token: get().batchTransfers.token || "",
                        recipients: get().batchTransfers.data || []
                    });

                    // 4: Monitor
                    updateProcess({ batch: 'confirming' });
                    updateBatchTransfers({ txid });
                    const txConfirmed = await tron.pollTx(txid);
                    if (!txConfirmed) {
                        updateProcess({ batch: 'timeout' });
                        toast.warning("Transaction confirmation timed out");
                        return;
                    }

                    updateProcess({ batch: 'confirmed' });
                } catch (error) {
                    const message = (error as Error).message;
                    updateProcess({ batch: 'failed' });
                    updateBatchTransfers({ error: message });
                    toast.error(message);
                } finally {
                    set({ isLoading: false });
                }
            },

            resumeTransferMonitoring: async (manual: boolean = false) => {
                const { isTransferPending, isLoading, energyRental,
                    singleTransferData, updateSingleTransfer, processStage, updateProcess,
                    clearSingleTransfer, clearProcessStage, clearEnergyRental
                } = get();
                const sender = useSenderStore.getState();

                // 1. Pre-check
                if (isLoading) return;
                if (!isTransferPending("single")) return;
                if (sender.active.address && !!singleTransferData.fromAddress && sender.address !== singleTransferData.fromAddress) {
                    clearSingleTransfer();
                    clearProcessStage("single");
                    clearEnergyRental();
                    toast.info("Cleared tasks from previous account.");
                    return;
                }

                // 2. Determine conditions
                const canResumeEnergyMonitoring = ["renting-energy", "energy-timeout"].includes(processStage.single);
                const canResumeTransferMonitoring = ["confirming", "timeout"].includes(processStage.single) && !!singleTransferData.txid;

                if (!canResumeTransferMonitoring && !canResumeEnergyMonitoring) {
                    if (manual) toast.info("No interrupted task found to resume.")
                    return;
                }

                try {
                    set({ isLoading: true });
                    // 3A: Energy
                    if (canResumeEnergyMonitoring) {
                        updateProcess({ single: 'renting-energy' });
                        toast.info("Resuming single transfer energy rental monitoring...");
                        const success = await pollEnergy({ requiredEnergy: energyRental.targetTier || 0 });
                        if (!success) {
                            updateProcess({ single: 'energy-timeout' });
                            toast.warning("Energy rental timed out.");
                        } else {
                            updateProcess({ single: 'idle' });
                            updateSingleTransfer({ txid: undefined, error: undefined });
                            set({ energyRental: { ...energyRental, txid: undefined, isMonitoring: false } });
                            toast.success("Energy acquired! Please submit Transfer again immediately.");
                        }
                        return;
                    }
                    // 3B: Transfer
                    else if (canResumeTransferMonitoring) {
                        toast.info("Resuming single transaction confirmation monitoring...");
                        updateProcess({ single: 'confirming' });
                        const mode = sender.adapter ? "adapter" : "privateKey";
                        const tron = new TronFrontendService(mode, { network: singleTransferData.network as Network, privateKey: sender.privateKey });
                        const txConfirmed = await tron.pollTx(singleTransferData.txid!);
                        if (!txConfirmed) {
                            updateProcess({ single: 'timeout' });
                            toast.warning("Transaction confirmation timed out");
                            return;
                        }
                        updateProcess({ single: 'confirmed' });
                    }
                } catch (error) {
                    const message = (error as Error).message;
                    updateProcess({ single: 'failed' });
                    updateSingleTransfer({ error: message });
                    toast.error(message);
                } finally {
                    set({ isLoading: false });
                }
            },

            resumeBatchTransferMonitoring: async (manual: boolean = false) => {
                const { isTransferPending, isLoading, energyRental,
                    batchTransfers, updateBatchTransfers, processStage, updateProcess,
                    clearBatchTransfers, clearProcessStage, clearEnergyRental } = get();
                const sender = useSenderStore.getState();

                // 1. Pre-check
                if (isLoading) return;
                if (!isTransferPending("batch")) return;
                if (sender.active.address && !!batchTransfers.fromAddress && sender.address !== batchTransfers.fromAddress) {
                    clearBatchTransfers();
                    clearProcessStage("batch");
                    clearEnergyRental();
                    toast.info("Cleared tasks from previous account.");
                    return;
                }

                // 2. Determine conditions
                const canResumeApprovalMonitoring = processStage.batch === "approving" && !!batchTransfers.txid;
                const canResumeEnergyMonitoring = ["renting-energy", "energy-timeout"].includes(processStage.batch);
                const canResumeTransferMonitoring = ["confirming", "timeout"].includes(processStage.batch) && !!batchTransfers.txid;

                if (!canResumeApprovalMonitoring && !canResumeTransferMonitoring && !canResumeEnergyMonitoring) {
                    if (manual) toast.info("No interrupted task found to resume.")
                    return;
                }

                try {
                    set({ isLoading: true });
                    // 3A: Approval
                    if (canResumeApprovalMonitoring) {
                        updateProcess({ batch: 'approving' });
                        toast.info("Resuming batch transfer approval monitoring...");
                        const mode = sender.adapter ? "adapter" : "privateKey";
                        const tron = new TronFrontendService(mode, { network: batchTransfers.network as Network, privateKey: sender.privateKey });
                        const txConfirmed = await tron.pollTx(batchTransfers.txid!);
                        if (!txConfirmed) {
                            updateProcess({ batch: 'timeout' });
                            toast.warning("Transaction confirmation timed out");
                            return;
                        }
                        updateProcess({ batch: 'idle' });
                        updateBatchTransfers({ txid: undefined });
                        toast.success("Approval confirmed! Please proceed with Transfer immediately.");
                        return;
                    }
                    // 3B: Energy
                    if (canResumeEnergyMonitoring) {
                        updateProcess({ batch: 'renting-energy' });
                        toast.info("Resuming batch transfer energy rental monitoring...");
                        const success = await pollEnergy({ requiredEnergy: energyRental.targetTier || 0 });
                        if (!success) {
                            updateProcess({ batch: 'energy-timeout' });
                            toast.warning("Energy rental timed out.");
                        } else {
                            updateProcess({ batch: 'idle' });
                            updateBatchTransfers({ txid: undefined, error: undefined });
                            set({ energyRental: { ...energyRental, txid: undefined, isMonitoring: false }, });
                            toast.success("Energy acquired! Please submit Transfer again immediately.");
                        }
                        return;
                    }
                    // 3C: Transfer
                    else if (canResumeTransferMonitoring) {
                        updateProcess({ batch: 'confirming' });
                        toast.info("Resuming batch transaction confirmation monitoring...");
                        const mode = sender.adapter ? "adapter" : "privateKey";
                        const tron = new TronFrontendService(mode, { network: batchTransfers.network as Network, privateKey: sender.privateKey });
                        const txConfirmed = await tron.pollTx(batchTransfers.txid!);
                        if (!txConfirmed) {
                            updateProcess({ batch: 'timeout' });
                            toast.warning("Transaction confirmation timed out");
                            return;
                        }
                        updateProcess({ batch: 'confirmed' });
                    }
                } catch (error) {
                    const message = (error as Error).message;
                    updateProcess({ batch: 'failed' });
                    updateBatchTransfers({ error: message });
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
    })
);