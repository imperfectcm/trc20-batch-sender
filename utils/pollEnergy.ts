import { useSenderStore } from "./store";

export async function pollEnergy(payload: { requiredEnergy: number, timeoutMs?: number, intervalMs?: number }): Promise<boolean> {
    const {
        requiredEnergy,
        timeoutMs = 180000,
        intervalMs = 5000
    } = payload;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            try {
                if (Date.now() - startTime > timeoutMs) {
                    clearInterval(interval);
                    resolve(false);
                    return;
                }

                const currentEnergy = useSenderStore.getState().profile.energy || 0;
                if (currentEnergy >= requiredEnergy) {
                    clearInterval(interval);
                    resolve(true);
                }
            } catch (error) {
                console.error("Failed to poll energy:", error);
                clearInterval(interval);
                reject(error);
            }
        }, intervalMs);
    });
}