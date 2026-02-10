"use client";

import { useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useOperationStore } from "@/utils/store";
import { useReqDebounce } from "@/hooks/useReqDebounce";

export const CheckAddressContainer = () => {
    const checkAddress = useOperationStore(state => state.checkAddress);
    const isLoading = useOperationStore((state) => state.isLoading);
    const [address, setAddress] = useState("");

    const debouncedCheck = useReqDebounce("checkAddress", checkAddress);
    const handleClick = async () => {
        await debouncedCheck(address);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleClick();
        }
    }

    return (
        <section className="w-full flex flex-col gap-y-4">
            <p className="text-sm text-stone-400">
                Check the validity of a TRON address.
            </p>
            <div className="flex gap-x-2">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} onKeyDown={handleKeyDown} />
                <Button variant="outline" onClick={handleClick} disabled={isLoading}>Check</Button>
            </div>
        </section>
    )
}