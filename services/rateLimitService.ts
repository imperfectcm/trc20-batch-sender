class RateLimitService {
    private static requests: Array<bigint> = [];
    private static dailyCounter: number = 0;
    private static MAX_PER_SECOND = 15; // Tongrid free tier limit
    private static MAX_PER_DAY = 100000; // Tongrid free tier limit

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

    resetDailyCounter(): void {
        RateLimitService.dailyCounter = 0;
    }

    private checkLimit = (): { allowed: true } | { allowed: false, reason: "daily" | "second" } => {
        if (RateLimitService.dailyCounter >= RateLimitService.MAX_PER_DAY) {
            return { allowed: false, reason: "daily" };
        }

        const now = process.hrtime.bigint();
        const oneSecondAgo = now - BigInt(1_000_000_000);

        while (RateLimitService.requests.length > 0 && RateLimitService.requests[0] < oneSecondAgo) {
            RateLimitService.requests.shift();
        }

        if (RateLimitService.requests.length >= RateLimitService.MAX_PER_SECOND) {
            return { allowed: false, reason: "second" };
        }

        return { allowed: true };
    }

    private recordRequest(): void {
        const now = process.hrtime.bigint();
        RateLimitService.requests.push(now);
        RateLimitService.dailyCounter++;
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
                const guard = this.checkLimit();

                if (!guard.allowed && guard.reason === "daily") {
                    const error = new Error("Daily API request limit exceeded");
                    while (this.queue.length > 0) {
                        const task = this.queue.shift()!;
                        task.reject(error);
                    }
                    return;
                }

                if (!guard.allowed && guard.reason === "second") {
                    await this.sleep(1000);
                    continue;
                }

                if (guard.allowed) {
                    const task = this.queue.shift();
                    if (task) {
                        this.recordRequest();
                        try {
                            const result = await task.fn();
                            task.resolve(result);
                        } catch (error) {
                            task.reject(error as Error);
                        }
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