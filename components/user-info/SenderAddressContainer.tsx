"use client";

import { useSenderStore } from "@/utils/store";
import InputEndInlineButton from "../utils/InputEndInlineButton";
import { Check } from "lucide-react";

export const SenderAddressContainer = () => {
    const setAddress = useSenderStore((state) => state.setAddress);
    const validateAddress = useSenderStore((state) => state.validateAddress);
    const setActive = useSenderStore((state) => state.setActive);
    const addressActivated = useSenderStore((state) => state.active.address);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAddress(e.target.value);
    }

    const handleActivateAddress = async () => {
        const address = useSenderStore.getState().address;
        const isValid = await validateAddress(address);
        if (!isValid) return;
        setActive('address', true);
    }

    return (
        <div className="w-full flex items-end gap-x-2">
            <InputEndInlineButton
                label="Sender Address"
                placeholder="your Tron address"
                handleChange={handleChange}
                handleClick={handleActivateAddress}
                type="text"
                activated={addressActivated}
            />
            
        </div>
    )
}