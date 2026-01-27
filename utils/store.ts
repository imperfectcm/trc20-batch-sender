import { create, StoreApi, UseBoundStore } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from "sonner";

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

type SenderState = {
    address: string;
    privateKey: string;
    active: { address: boolean; privateKey: boolean; }
    profile: { trx?: number, usdt?: number, energy?: number, bandwidth?: number };
    isLoading: boolean;
};

type SenderActions = {
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
    create<SenderState & SenderActions>()(
        persist(
            (set, get) => ({
                address: "",
                privateKey: "",
                active: { address: false, privateKey: false },
                profile: { trx: undefined, usdt: undefined, energy: undefined, bandwidth: undefined },
                isLoading: false,
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
                        set({ isLoading: true });
                        const res = await fetch(`/api/validate-private-key`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ privateKey }),
                        });
                        const result = await res.json();
                        if (!result.success) {
                            throw new Error(result.message || "Failed to validate private key");
                        }
                        if (!result.data) {
                            toast.warning("Invalid private key");
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
                    const address = get().address;
                    if (!address) return;
                    try {
                        const res = await fetch(`/api/profile?address=${address}`);
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