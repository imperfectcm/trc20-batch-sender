interface TokenBucket {
    tokens: number;
    updatedMs: number;
}

class RateLimitService {
    private readonly MAX_PER_SECOND = 5;
    private readonly TOKEN_BURST = 10;
    private tokenBucket: TokenBucket = { tokens: 0, updatedMs: Date.now() };

    private queue: Array<{
        fn: () => Promise<any>;
        resolve: (value: any) => void;
        reject: (error: Error) => void;
    }> = [];
    private processing = false;

    constructor() { }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private waitForQuota = async (): Promise<void> => {
        while (true) {
            const nowMs = Date.now();
            const elapsedMs = Math.max(0, nowMs - this.tokenBucket.updatedMs);

            this.tokenBucket.tokens = Math.min(
                this.TOKEN_BURST,
                this.tokenBucket.tokens + elapsedMs / 1000 * this.MAX_PER_SECOND,
            );
            this.tokenBucket.updatedMs = nowMs;

            if (this.tokenBucket.tokens >= 1) {
                this.tokenBucket.tokens -= 1;
                return;
            }

            const waitMs = Math.ceil(
                (1 - this.tokenBucket.tokens) / this.MAX_PER_SECOND * 1000,
            );
            await this.sleep(waitMs);
        }
    }

    executeWithQueue = async<T>(fn: () => Promise<T>): Promise<T> => {
        return new Promise<T>((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            if (!this.processing) {
                this.processQueue();
            }
        });
    }

    processQueue = async (): Promise<void> => {
        if (this.processing) return; // Atomic check
        this.processing = true;

        try {
            while (this.queue.length > 0) {
                await this.waitForQuota();

                const task = this.queue.shift();
                if (task) {
                    try {
                        const result = await task.fn();
                        task.resolve(result);
                    } catch (error) {
                        task.reject(error as Error);
                    }
                }
            }
        } finally {
            this.processing = false;
        }
    }
}

export const rateLimiter = new RateLimitService();
export { RateLimitService };