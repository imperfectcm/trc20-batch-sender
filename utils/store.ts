import { create, StoreApi, UseBoundStore } from 'zustand';
import { toast } from "sonner"

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

type SenderState = {
    address: string;
    privateKey: string;
    active: { address: boolean; privateKey: boolean; }
};

type SenderActions = {
    setAddress: (address: SetStateAction<string>) => void;
    setPrivateKey: (privateKey: SetStateAction<string>) => void;
    setActive: (field: 'address' | 'privateKey', value: SetStateAction<boolean>) => void;
    validateAddress: (address: string) => Promise<boolean>;
    validatePrivateKey: (privateKey: string) => Promise<boolean>;
    reset: () => void;
}

export const useSenderStore = createSelectors(
    create<SenderState & SenderActions>((set, get) => ({
        address: "",
        privateKey: "",
        active: { address: false, privateKey: false },
        setAddress: (address) =>
            set((state) => ({
                address: resolveState(address, state.address),
            })),
        setPrivateKey: (privateKey) =>
            set((state) => ({
                privateKey: resolveState(privateKey, state.privateKey),
            })),
        setActive: (field, value) =>
            set((state) => ({
                active: {
                    ...state.active,
                    [field]: resolveState(value, state.active[field]),
                },
            })),
        validateAddress: async (address: string): Promise<boolean> => {
            const res = await fetch(`/api/validate-address`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address }),
            });
            const data = await res.json();
            if (!data.success) {
                toast.error(data.message || "Failed to validate address");
                return false;
            }
            if (!data.data) {
                toast.warning("Invalid address");
                return false;
            }
            return data.success;
        },
        validatePrivateKey: async (privateKey: string): Promise<boolean> => {
            const res = await fetch(`/api/validate-private-key`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ privateKey }),
            });
            const data = await res.json();
            if (!data.success) {
                toast.error(data.message || "Failed to validate private key");
                return false;
            }
            if (!data.data) {
                toast.warning("Invalid private key");
                return false;
            }
            return data.success;
        },
        reset: () => set({ address: "", privateKey: "", active: { address: false, privateKey: false } }),
    })),
);