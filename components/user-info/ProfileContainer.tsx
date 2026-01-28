"use client";

import { useSenderStore } from "@/utils/store";

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

    return (
        <section className="w-full space-y-2">
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
        </section>
    )
}