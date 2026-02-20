"use client";

import { useSenderStore } from "@/utils/store";
import InputEndInlineButton from "../utils/InputEndInlineButton";

export const SenderAddressContainer = () => {
    const address = useSenderStore((state) => state.address);
    const setAddress = useSenderStore((state) => state.setAddress);
    const validateAddress = useSenderStore((state) => state.validateAddress);
    const updateActive = useSenderStore((state) => state.updateActive);
    const addressActivated = useSenderStore((state) => state.active.address);
    const isLoading = useSenderStore((state) => state.isLoading);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAddress(e.target.value);
    }

    const handleActivateAddress = async () => {
        const isValid = await validateAddress();
        if (!isValid) return;
        updateActive({ address: true });
    }

    return (
        <section className="w-full">
            <InputEndInlineButton
                type="text"
                label="Sender Address"
                value={address}
                placeholder="Your TRON address"
                handleChange={handleChange}
                handleClick={handleActivateAddress}
                activated={addressActivated}
                isLoading={isLoading}
            />
        </section>
    )
}