"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Network, NETWORK_OPTIONS } from "@/models/network";
import { useSenderStore } from "@/utils/store";
import { Label } from "../ui/label";

export const NetworkContainer = () => {
    const network = useSenderStore((state) => state.network);
    const setNetwork = useSenderStore((state) => state.setNetwork);
    const fetchProfile = useSenderStore((state) => state.fetchProfile);

    const handleNetworkChange = (value: string) => {
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