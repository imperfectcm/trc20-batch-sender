"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onCopy'> {
    content: string;
    variant?: "default" | "ghost" | "outline" | "secondary" | "destructive" | "link";
    size?: "sm" | "default" | "lg" | "icon";
    delay?: number;
    onCopy?: (content: string) => void;
}

const iconSizes = {
    sm: 12,
    default: 16,
    lg: 20,
    icon: 16,
};

export function CopyButton({
    content,
    variant = "default",
    size = "default",
    delay = 3000,
    onCopy,
    className,
    ...props
}: CopyButtonProps) {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setIsCopied(true);
            onCopy?.(content);

            setTimeout(() => {
                setIsCopied(false);
            }, delay);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const iconSize = iconSizes[size];

    return (
        <Button
            variant={variant}
            size={size}
            onClick={handleCopy}
            className={cn("relative overflow-hidden h-auto p-2", className)}
            {...props}
        >
            <span
                className={cn(
                    "absolute inset-0 flex items-center justify-center transition-all duration-200",
                    isCopied ? "scale-0 opacity-0" : "scale-100 opacity-100"
                )}
            >
                <Copy size={iconSize} />
            </span>

            <span
                className={cn(
                    "absolute inset-0 flex items-center justify-center transition-all duration-200",
                    isCopied ? "scale-100 opacity-100" : "scale-0 opacity-0"
                )}
            >
                <Check size={iconSize} />
            </span>

            {/* Spacer to maintain button size */}
            <span className="invisible">
                <Copy size={iconSize} />
            </span>
        </Button>
    );
}
