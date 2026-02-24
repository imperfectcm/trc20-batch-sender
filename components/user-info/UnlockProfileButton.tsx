"use client";

import { useOperationStore, useSenderStore } from "@/utils/store";
import { Button } from "../ui/button"
import { LockOpen } from "lucide-react";

export const UnlockProfileButton = () => {
    const adapter = useSenderStore((state) => state.adapter);
    const active = useSenderStore((state) => state.active);
    const disconnectAdapter = useSenderStore((state) => state.disconnectAdapter);

    const operationLoading = useOperationStore((state) => state.isLoading);
    const isTransferActive = useOperationStore((state) => state.isTransferActive);
    const disabled = operationLoading || isTransferActive("single") || isTransferActive("batch");

    const handleUnlockInput = () => {
        if (adapter) adapter.disconnect();
        disconnectAdapter();
    }

    return (
        <div className="w-full text-center">
            <Button
                variant="outline"
                onClick={handleUnlockInput}
                disabled={!active.address && !active.privateKey || disabled}
            >
                <LockOpen />Unlock Profile
            </Button>
        </div>
    )
}