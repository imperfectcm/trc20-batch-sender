import { useSenderStore } from "./store";

export async function pollEnergy(payload: { requiredEnergy: number, timeoutMs?: number, intervalMs?: number, mae?: number }): Promise<boolean> {
    const {
        requiredEnergy,
        timeoutMs = 240000, // Default timeout of 4 minutes
        intervalMs = 5000,
        mae = 0.99 // Minimum acceptable energy ratio
    } = payload;
    const startTime = Date.now();

    while (Date.now() - startTime <= timeoutMs) {
        const currentEnergy = useSenderStore.getState().profile.energy || 0;
        if (currentEnergy >= requiredEnergy * mae) return true;

        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return false;
}
