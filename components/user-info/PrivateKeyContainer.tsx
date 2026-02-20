"use client";

import { useSenderStore } from "@/utils/store";
import InputEndInlineButton from "../utils/InputEndInlineButton";
import { useState } from "react";
import { Eye, EyeClosed } from "lucide-react";

export const PrivateKeyContainer = () => {
    const setPrivateKey = useSenderStore((state) => state.setPrivateKey);
    const validatePrivateKey = useSenderStore((state) => state.validatePrivateKey);
    const updateActive = useSenderStore((state) => state.updateActive);
    const privateKeyActivated = useSenderStore((state) => state.active.privateKey);
    const isLoading = useSenderStore((state) => state.isLoading);

    const [canView, setCanView] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPrivateKey(e.target.value);
    }

    const handleActivatePrivateKey = async () => {
        const privateKey = useSenderStore.getState().privateKey;
        const isValid = await validatePrivateKey(privateKey);
        if (!isValid) return;
        updateActive({ privateKey: true });
    }

    const inputType: "text" | "password" = privateKeyActivated ? "password" : canView ? "text" : "password";

    return (
        <section className="relative w-full">
            <InputEndInlineButton
                label="Private Key"
                placeholder="Your private key or mnemonic phrase"
                handleChange={handleChange}
                handleClick={handleActivatePrivateKey}
                type={inputType}
                activated={privateKeyActivated}
                isLoading={isLoading}
            />
            {!privateKeyActivated &&
                <button className="absolute translate-y-1/2 bottom-4.5 right-8 text-stone-600 py-1" onClick={() => setCanView(!canView)}>
                    {canView ? <Eye size={20} strokeWidth={1} /> : <EyeClosed size={20} strokeWidth={1} />}
                </button>
            }
        </section>
    )
}