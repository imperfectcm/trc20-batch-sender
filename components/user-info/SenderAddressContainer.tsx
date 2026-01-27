"use client";

import { useSenderStore } from "@/utils/store";
import InputEndInlineButton from "../utils/InputEndInlineButton";

export const SenderAddressContainer = () => {
    const setAddress = useSenderStore((state) => state.setAddress);
    const validateAddress = useSenderStore((state) => state.validateAddress);
    const setActive = useSenderStore((state) => state.setActive);
    const addressActivated = useSenderStore((state) => state.active.address);
    const isLoading = useSenderStore((state) => state.isLoading);

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
        <section className="w-full">
            <InputEndInlineButton
                label="Sender Address"
                defaultValue={useSenderStore.getState().address}
                placeholder="Your TRON address"
                handleChange={handleChange}
                handleClick={handleActivateAddress}
                type="text"
                activated={addressActivated}
                isLoading={isLoading}
            />
        </section>
    )
}