import { Network } from "@/models/network";

export async function pollTransaction(payload: { txid: string, token: string, network: Network, timeoutMs?: number, intervalMs?: number }): Promise<boolean> {
    const {
        txid,
        token,
        network,
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

                const res = await fetch(`/api/transfer/check`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ network, txid, token }),
                });
                const result = await res.json();

                if (!result.success) {
                    throw new Error(result.message || "Failed to check transaction status");
                }

                const { completed, confirmed, error } = result.data;

                if (completed) {
                    clearInterval(interval);
                    if (confirmed) {
                        resolve(true);
                    } else {
                        reject(new Error(error || "Transaction reverted on chain"));
                    }
                }
            } catch (error) {
                clearInterval(interval);
                throw error;
            }
        }, intervalMs);
    });
}