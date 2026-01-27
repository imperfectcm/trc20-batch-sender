"use client";

import { useSenderStore } from "@/utils/store";
import { Button } from "../ui/button"
import { LockOpen } from "lucide-react";

export const UnlockProfileButton = () => {
    const active = useSenderStore((state) => state.active);
    const setActive = useSenderStore((state) => state.setActive);

    const handleUnlockInput = () => {
        setActive('address', false);
        setActive('privateKey', false);
    }

    return (
        <div className="w-full text-center">
            <Button
                variant="outline"
                onClick={handleUnlockInput}
                disabled={!active.address && !active.privateKey}
            >
                <LockOpen />Unlock Profile
            </Button>
        </div>
    )
}