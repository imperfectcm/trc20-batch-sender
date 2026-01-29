"use client";

import { useSenderStore } from "@/utils/store";
import { RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { useRef } from "react";
import { toast } from "sonner";

const PROFILE_FIELDS = [
    { key: "trx", label: "TRX Balance" },
    { key: "usdt", label: "USDT Balance" },
    { key: "energy", label: "Energy" },
    { key: "bandwidth", label: "Bandwidth" },
] as const;

const formatValue = (value?: number) => {
    if (value == null) return '-';
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
};

export const ProfileContainer = () => {
    const profile = useSenderStore((state) => state.profile);
    const addressActivated = useSenderStore((state) => state.active.address);
    const fetchProfile = useSenderStore((state) => state.fetchProfile);

    const lastRefreshTime = useRef<number>(0);
    const DEBOUNCE_TIME = 5000;

    const handleRefresh = () => {
        const now = Date.now();

        if (now - lastRefreshTime.current < DEBOUNCE_TIME) {
            toast.warning('Too frequent, try again later');
            return;
        }

        lastRefreshTime.current = now;
        fetchProfile();
    };

    return (
        <section className="relative w-full">
            <div className="w-full h-auto py-10 ring-1 ring-neutral-600 grid grid-cols-4 rounded-lg tangerine-card-shadow">
                {PROFILE_FIELDS.map(({ key, label }) => (
                    <div
                        key={key}
                        className="flex flex-col justify-center items-center"
                    >
                        <p className="font-quantico text-sm text-neutral-400">{label}</p>
                        <p className={`text-lg font-semibold ${addressActivated ? 'text-tangerine/80' : 'text-neutral-400'}`}>
                            {addressActivated ? formatValue(profile[key]) : '-'}
                        </p>
                    </div>
                ))}
            </div>
            <Button variant="ghost" onClick={handleRefresh} disabled={!addressActivated}
                className={`${!addressActivated && "hidden"} absolute bottom-2 right-2 h-auto p-2`}>
                <RefreshCw size={16} />
            </Button>
        </section>
    )
}