"use client";

import { useRef, useCallback } from "react";
import { toast } from "sonner";

export const DEBOUNCE_TIME = 5000;

export const useReqDebounce = <K, T extends (...args: any[]) => Promise<any>>(
    key: K,
    callback: T
) => {
    const lastCallTime = useRef<Map<K, number>>(new Map());
    return useCallback(
        async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
            const now = Date.now();

            const lastTime = lastCallTime.current.get(key) || 0;

            if (now - lastTime < DEBOUNCE_TIME) {
                toast.warning('Too frequent, try again later');
                return;
            }

            lastCallTime.current.set(key, now);
            return await callback(...args);
        },
        [key, callback]
    );
};