"use client";

import { useSenderStore } from "@/utils/store";
import InputEndInlineButton from "../utils/InputEndInlineButton";

export const PrivateKeyContainer = () => {
    const setPrivateKey = useSenderStore((state) => state.setPrivateKey);
    const validatePrivateKey = useSenderStore((state) => state.validatePrivateKey);
    const setActive = useSenderStore((state) => state.setActive);
    const privateKeyActivated = useSenderStore((state) => state.active.privateKey);
    const isLoading = useSenderStore((state) => state.isLoading);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPrivateKey(e.target.value);
    }

    const handleActivatePrivateKey = async () => {
        const privateKey = useSenderStore.getState().privateKey;
        const isValid = await validatePrivateKey(privateKey);
        if (!isValid) return;
        setActive('privateKey', true);
    }

    const inputType: "text" | "password" = privateKeyActivated ? "password" : "text";

    return (
        <section className="w-full">
            <InputEndInlineButton
                label="Private Key"
                placeholder="Your private key"
                handleChange={handleChange}
                handleClick={handleActivatePrivateKey}
                type={inputType}
                activated={privateKeyActivated}
                isLoading={isLoading}
            />
        </section>
    )
}