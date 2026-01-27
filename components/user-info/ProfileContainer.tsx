"use client";

import { useSenderStore } from "@/utils/store";

export const ProfileContainer = () => {
    const profile = useSenderStore((state) => state.profile);
    const addressActivated = useSenderStore((state) => state.active.address);

    const profileInfo: Map<string, number | undefined> = new Map([
        ["TRX Balance", profile.trx],
        ["USDT Balance", profile.usdt],
        ["Energy", profile.energy],
        ["Bandwidth", profile.bandwidth],
    ]);

    return (
        <section className="w-full space-y-2">
            <h2 className="text-lg font-medium">Profile Information</h2>
            <div className="w-full h-auto py-10 ring-1 ring-neutral-600 grid grid-cols-4 rounded-lg tangerine-card-shadow">
                {Array.from(profileInfo.entries()).map(([key, value]) => {
                    const displayValue = value == undefined
                        ? '-'
                        : Number.isInteger(value) ? value : value.toFixed(2);

                    return (
                        <div
                            key={key}
                            className="flex flex-col justify-center items-center"
                        >
                            <p className="font-quantico text-sm text-neutral-400">{key}</p>
                            {addressActivated ?
                                <p className="text-lg font-semibold text-tangerine/60">{displayValue}</p>
                                :
                                <p className="text-lg font-semibold text-neutral-400">-</p>
                            }
                        </div>
                    )
                })}
            </div>
        </section>
    )
}