"use client";

import { useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useOperationStore } from "@/utils/store";
import { useReqDebounce } from "@/hooks/useReqDebounce";
import { toast } from "sonner";

export const CheckAddressContainer = () => {
    const validateAddress = useOperationStore(state => state.validateAddress);
    const isLoading = useOperationStore((state) => state.isLoading);
    const [address, setAddress] = useState("");

    const debouncedCheck = useReqDebounce("validateAddress", validateAddress);
    const handleClick = async () => {
        try {
            const isValided = await debouncedCheck(address);
            if (isValided) {
                toast.success("The address is valid.", { icon: '✔' });
            } else {
                toast.error("Invalid TRON address", { icon: '✘' });
            }
        } catch (error) {
            toast.error((error as Error).message || "Failed to validate address");
        }
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
                <Button variant="outline" className="h-auto p-2 text-stone-400 hover:text-tangerine" onClick={handleClick} disabled={isLoading}>Check</Button>
            </div>
        </section>
    )
}