"use client";

import { useSenderStore } from "@/utils/store";
import { RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { useReqDebounce } from "@/hooks/useReqDebounce";

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

    const debouncedFetch = useReqDebounce("fetchProfile", fetchProfile);

    const handleRefresh = async () => {
        await debouncedFetch();
    };

    return (
        <article className="relative w-full">
            <div className="w-full h-auto py-10 ring-1 ring-stone-600 grid grid-cols-4 rounded-lg tangerine-card-shadow">
                {PROFILE_FIELDS.map(({ key, label }) => (
                    <div
                        key={key}
                        className="flex flex-col justify-center items-center"
                    >
                        <p className="font-quantico text-sm text-stone-400">{label}</p>
                        <p className={`text-lg font-semibold ${addressActivated ? 'text-tangerine/80' : 'text-stone-400'}`}>
                            {addressActivated ? formatValue(profile[key]) : '-'}
                        </p>
                    </div>
                ))}
            </div>
            {addressActivated && (
                <Button variant="ghost" onClick={handleRefresh} disabled={!addressActivated}
                    className={`absolute bottom-2 right-2 h-auto p-2 text-stone-600 hover:text-tangerine`}>
                    <RefreshCw size={16} />
                </Button>
            )}
        </article>
    )
}