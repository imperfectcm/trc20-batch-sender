import { create, StoreApi, UseBoundStore } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from "sonner";
import { Network } from '@/models/network';
import { TronGridTrc20Transaction } from '@/models/tronResponse';

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

let pollInterval: NodeJS.Timeout | null = null;

type SenderStates = {
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
                        const res = await fetch(`/api/validate-address`, {
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
                            toast.warning("Invalid address");
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
                        const res = await fetch(`/api/validate-private-key`, {
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
                startPolling: (intervalMs = 60000) => {
                    if (pollInterval) return;

                    pollInterval = setInterval(() => {
                        const { active, address } = get();
                        if (active.address && address) {
                            get().fetchProfile();
                        }
                    }, intervalMs);
                },
                stopPolling: () => {
                    if (pollInterval) {
                        clearInterval(pollInterval);
                        pollInterval = null;
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
}

type OperationActions = {
    validateAddress: (address: string) => Promise<boolean>;
    fetchTransferRecords: (payload: { network?: Network, address: string }) => Promise<void>;
}

export const useOperationStore = createSelectors(
    create<OperationStates & OperationActions>()(
        (set, get) => ({
            isLoading: false,
            transferRecords: [],
            validateAddress: async (address: string): Promise<boolean> => {
                try {
                    set({ isLoading: true });
                    const res = await fetch(`/api/validate-address`, {
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
                        toast.error("This is an invalid TRON address", { icon: '✘' });
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
                    const res = await fetch(`/api/transfer-record`, {
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
            }
        })
    )
);