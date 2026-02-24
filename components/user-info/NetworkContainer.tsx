"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Network, NETWORK_OPTIONS } from "@/models/network";
import { useOperationStore, useSenderStore } from "@/utils/store";
import { Label } from "../ui/label";
import { toast } from "sonner";

export const NetworkContainer = () => {
    const network = useSenderStore((state) => state.network);
    const setNetwork = useSenderStore((state) => state.setNetwork);
    const fetchProfile = useSenderStore((state) => state.fetchProfile);

    const operationLoading = useOperationStore((state) => state.isLoading);
    const isTransferActive = useOperationStore((state) => state.isTransferActive);
    const disabled = operationLoading || isTransferActive("single") || isTransferActive("batch");

    const handleNetworkChange = (value: string) => {
        if (disabled) {
            toast.warning("Cannot change network during transaction process.");
            return
        };
        setNetwork(value as Network);
        fetchProfile();
    }

    return (
        <section className="w-full">
            <Label>Network</Label>
            <Select value={network} onValueChange={handleNetworkChange}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Network" />
                </SelectTrigger>
                <SelectContent>
                    {NETWORK_OPTIONS.map((option) => (
                        <SelectItem
                            key={option.value}
                            value={option.value}
                            onSelect={() => setNetwork(option.value)}
                        >
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </section>
    )
}