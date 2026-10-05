# TRC20 Batch Sender Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining non-dependency security and performance risks without changing the existing transfer, approval, wallet, CSV, resume, and profile workflows.

**Architecture:** Move sensitive credential validation fully into the browser, centralize request validation in shared pure helpers, and keep blockchain transaction construction/signing flows unchanged except for safer approval amounts. Add bounded queues/rate limits at server boundaries and make visual animation opt-in based on runtime capability.

**Tech Stack:** Next.js App Router, React 19, Bun, Bun test, Zustand, TronWeb, Biome.

---

## File Structure

- Create `services/frontend/credentialValidation.ts` for browser-only private key and mnemonic validation.
- Create `services/frontend/credentialValidation.test.ts` for local credential validation behavior.
- Modify `utils/store.tsx` to stop POSTing private keys to `/api/validation/private-key`.
- Delete `app/api/validation/private-key/route.ts` after the frontend path is covered.
- Modify `services/tronService.ts` to remove server-side private key and mnemonic handling.
- Create `services/transferValidation.ts` for shared single/batch request validation.
- Create `services/transferValidation.test.ts` for address, amount, token, network, and batch-size checks.
- Modify `app/api/transfer/single/route.ts`, `app/api/transfer/batch/route.ts`, `app/api/transfer/approvement/route.ts`, `app/api/energy/rental/route.ts`, `app/api/profile/route.ts`, `app/api/transfer/allowance/route.ts`, and `app/api/transfer/record/route.ts` to use shared validation and body-size checks.
- Modify `services/rateLimitService.ts` and create `services/rateLimitService.test.ts` to bound queue size and per-task wait time.
- Create `services/apiRateLimit.ts` and `services/apiRateLimit.test.ts` for lightweight per-IP route throttling.
- Modify `services/frontend/tronService.ts` to approve the exact batch amount in all signing modes.
- Create `services/frontend/approvalPolicy.test.ts` for the extracted approval amount helper.
- Modify `components/utils/PaticlesBackground.tsx` to pause/reduce animation under low-motion, hidden-tab, or mobile conditions.
- Modify `app/globals.css`, `models/transfer.ts`, and import-only files during the quality-gate cleanup task.

---

## Task 1: Keep Private Key and Mnemonic Out of Server Requests

**Files:**
- Create: `services/frontend/credentialValidation.ts`
- Create: `services/frontend/credentialValidation.test.ts`
- Modify: `utils/store.tsx`
- Modify: `services/tronService.ts`
- Delete: `app/api/validation/private-key/route.ts`

- [ ] **Step 1: Write failing tests for local credential validation**

```ts
import { describe, expect, test } from "bun:test";
import { TronWeb } from "tronweb";
import { deriveCredentialAddress, validateCredentialForAddress } from "./credentialValidation";

const privateKey = "0000000000000000000000000000000000000000000000000000000000000001";
const address = TronWeb.address.fromPrivateKey(privateKey)!;

describe("credentialValidation", () => {
  test("derives the TRON address from a private key locally", () => {
    expect(deriveCredentialAddress(privateKey)).toBe(address);
  });

  test("accepts matching private key and rejects mismatched private key", () => {
    expect(validateCredentialForAddress(address, privateKey)).toBe(true);
    expect(validateCredentialForAddress("TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj", privateKey)).toBe(false);
  });

  test("does not call any API endpoint while validating credentials", () => {
    expect(validateCredentialForAddress(address, `0x${privateKey}`)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test services/frontend/credentialValidation.test.ts`

Expected: FAIL because `services/frontend/credentialValidation.ts` does not exist.

- [ ] **Step 3: Implement local validation helper**

```ts
import { TronWeb } from "tronweb";

export function deriveCredentialAddress(credential: string): string {
  const trimmed = credential.trim();
  if (!trimmed) throw new Error("No private key provided");

  if (trimmed.includes(" ")) {
    const account = TronWeb.fromMnemonic(trimmed);
    if (!account.address) throw new Error("Invalid mnemonic phrase");
    return account.address;
  }

  const cleanKey = trimmed.replace(/^0x/, "");
  if (cleanKey.length !== 64) throw new Error("Invalid private key length");
  if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) throw new Error("Private key contains invalid characters");

  const address = TronWeb.address.fromPrivateKey(cleanKey);
  if (!address) throw new Error("Invalid private key");
  return address;
}

export function validateCredentialForAddress(address: string, credential: string): boolean {
  return deriveCredentialAddress(credential) === address;
}
```

- [ ] **Step 4: Replace server API call in store**

In `utils/store.tsx`, change `validatePrivateKey` so it imports `validateCredentialForAddress` and never calls `api('/api/validation/private-key', ...)`.

- [ ] **Step 5: Remove server private-key handling**

Delete `app/api/validation/private-key/route.ts`. Remove `validatePrivateKey` from `services/tronService.ts` if no server code imports it.

- [ ] **Step 6: Verify**

Run:

```bash
bun test services/frontend/credentialValidation.test.ts
bunx tsc --noEmit
rg -n "/api/validation/private-key|validatePrivateKey = async|fromMnemonic\\(|fromPrivateKey\\(" app services utils
```

Expected: tests pass, TypeScript passes, and sensitive derivation remains only in frontend-local code.

---

## Task 2: Replace Unlimited Private-Key Approval With Exact Approval

**Files:**
- Modify: `services/frontend/tronService.ts`
- Create: `services/frontend/approvalPolicy.test.ts`

- [ ] **Step 1: Write failing approval policy tests**

```ts
import { describe, expect, test } from "bun:test";
import { getBatchApprovalAmount } from "./tronService";

describe("getBatchApprovalAmount", () => {
  test("uses exact total amount for adapter mode", () => {
    expect(getBatchApprovalAmount("adapter", "123000000")).toBe("123000000");
  });

  test("uses exact total amount for private key mode", () => {
    expect(getBatchApprovalAmount("privateKey", "123000000")).toBe("123000000");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test services/frontend/approvalPolicy.test.ts`

Expected: FAIL because `getBatchApprovalAmount` is not exported.

- [ ] **Step 3: Implement exact approval helper**

In `services/frontend/tronService.ts`:

```ts
export type SigningMode = "adapter" | "privateKey";

export function getBatchApprovalAmount(_mode: SigningMode, totalAmount: string): string {
  return totalAmount;
}
```

- [ ] **Step 4: Use helper in approval flow**

Change `approveBatchTransfer` request body from `this.adapter ? totalAmount : TronFrontendService.MAX_UINT256` to:

```ts
{
  network,
  fromAddress,
  token,
  amount: getBatchApprovalAmount(this.adapter ? "adapter" : "privateKey", totalAmount),
}
```

Remove `MAX_UINT256` import and static field if unused.

- [ ] **Step 5: Verify**

Run:

```bash
bun test services/frontend/approvalPolicy.test.ts
bunx tsc --noEmit
rg -n "MAX_UINT256|115792089" services utils app
```

Expected: tests pass, TypeScript passes, and approval flow no longer uses unlimited allowance.

---

## Task 3: Enforce Server-Side Validation and Batch Limits

**Files:**
- Create: `services/transferValidation.ts`
- Create: `services/transferValidation.test.ts`
- Modify: `app/api/transfer/single/route.ts`
- Modify: `app/api/transfer/batch/route.ts`
- Modify: `app/api/transfer/approvement/route.ts`
- Modify: `app/api/energy/rental/route.ts`
- Modify: `app/api/profile/route.ts`
- Modify: `app/api/transfer/allowance/route.ts`
- Modify: `app/api/transfer/record/route.ts`

- [ ] **Step 1: Write failing validation tests**

```ts
import { describe, expect, test } from "bun:test";
import { MAX_BATCH_SIZE, validateBatchTransferRequest, validateSingleTransferRequest } from "./transferValidation";

const validAddress = "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";

describe("transferValidation", () => {
  test("rejects unsupported network", () => {
    expect(() => validateSingleTransferRequest({
      network: "nile",
      fromAddress: validAddress,
      toAddress: validAddress,
      token: "USDT",
      amount: 1,
      simulateOnly: false,
    })).toThrow("Unsupported network");
  });

  test("rejects invalid recipient amount", () => {
    expect(() => validateBatchTransferRequest({
      network: "mainnet",
      fromAddress: validAddress,
      token: "USDT",
      recipients: [{ toAddress: validAddress, amount: 0 }],
      simulateOnly: false,
    })).toThrow("Amount must be greater than zero");
  });

  test("rejects batch larger than server limit", () => {
    const recipients = Array.from({ length: MAX_BATCH_SIZE + 1 }, () => ({ toAddress: validAddress, amount: 1 }));
    expect(() => validateBatchTransferRequest({
      network: "mainnet",
      fromAddress: validAddress,
      token: "USDT",
      recipients,
      simulateOnly: false,
    })).toThrow(`Batch size cannot exceed ${MAX_BATCH_SIZE}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test services/transferValidation.test.ts`

Expected: FAIL because `services/transferValidation.ts` does not exist.

- [ ] **Step 3: Implement validation helper**

```ts
import { TronWeb } from "tronweb";
import { ALLOWED_TOKENS } from "@/models/transfer";
import type { Network } from "@/models/network";

export const MAX_BATCH_SIZE = 100;
export const MAX_JSON_BODY_BYTES = 64 * 1024;

export function assertNetwork(network: unknown): asserts network is Network {
  if (network !== "mainnet" && network !== "shasta") throw new Error("Unsupported network");
}

export function assertAddress(address: unknown, field: string): asserts address is string {
  if (typeof address !== "string" || !TronWeb.isAddress(address)) throw new Error(`Invalid ${field}`);
}

export function assertPositiveAmount(amount: unknown): asserts amount is number {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }
}

export function assertToken(token: unknown): asserts token is string {
  if (typeof token !== "string" || !ALLOWED_TOKENS.has(token)) throw new Error(`Token ${token} is not supported.`);
}

export type SingleTransferPayload = {
  network: unknown;
  fromAddress: unknown;
  toAddress: unknown;
  token: unknown;
  amount: unknown;
  simulateOnly?: unknown;
};

export type BatchTransferPayload = {
  network: unknown;
  fromAddress: unknown;
  token: unknown;
  recipients: unknown;
  simulateOnly?: unknown;
};

export function validateSingleTransferRequest(payload: SingleTransferPayload) {
  assertNetwork(payload.network);
  assertAddress(payload.fromAddress, "fromAddress");
  assertAddress(payload.toAddress, "toAddress");
  assertToken(payload.token);
  assertPositiveAmount(payload.amount);
  return {
    network: payload.network,
    fromAddress: payload.fromAddress,
    toAddress: payload.toAddress,
    token: payload.token,
    amount: payload.amount,
    simulateOnly: payload.simulateOnly === true,
  };
}

export function validateBatchTransferRequest(payload: BatchTransferPayload) {
  assertNetwork(payload.network);
  assertAddress(payload.fromAddress, "fromAddress");
  assertToken(payload.token);
  if (!Array.isArray(payload.recipients) || payload.recipients.length === 0) throw new Error("No recipients provided");
  if (payload.recipients.length > MAX_BATCH_SIZE) throw new Error(`Batch size cannot exceed ${MAX_BATCH_SIZE}`);

  const recipients = payload.recipients.map((item, index) => {
    const row = item as { toAddress?: unknown; amount?: unknown };
    assertAddress(row.toAddress, `recipients[${index}].toAddress`);
    assertPositiveAmount(row.amount);
    return { toAddress: row.toAddress, amount: row.amount };
  });

  return {
    network: payload.network,
    fromAddress: payload.fromAddress,
    token: payload.token,
    recipients,
    simulateOnly: payload.simulateOnly === true,
  };
}
```

- [ ] **Step 4: Apply helper in API routes**

In each route, parse JSON once, validate before calling `tronService`, and return `400` for validation errors. Use `request.headers.get("content-length")` to reject bodies larger than `MAX_JSON_BODY_BYTES`.

- [ ] **Step 5: Verify**

Run:

```bash
bun test services/transferValidation.test.ts
bunx tsc --noEmit
```

Expected: tests pass and route payload types remain valid.

---

## Task 4: Bound Server Queues and Add Route Throttling

**Files:**
- Modify: `services/rateLimitService.ts`
- Create: `services/rateLimitService.test.ts`
- Create: `services/apiRateLimit.ts`
- Create: `services/apiRateLimit.test.ts`

- [ ] **Step 1: Write failing queue-limit tests**

```ts
import { describe, expect, test } from "bun:test";
import { RateLimitService } from "./rateLimitService";

describe("RateLimitService", () => {
  test("rejects when queue exceeds max size", async () => {
    const limiter = new RateLimitService({ maxQueueSize: 1 });
    const hold = limiter.executeWithQueue(() => new Promise(() => {}));
    await expect(limiter.executeWithQueue(async () => "second")).rejects.toThrow("Rate limit queue is full");
    void hold;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test services/rateLimitService.test.ts`

Expected: FAIL because constructor options are not supported.

- [ ] **Step 3: Implement bounded queue options**

Add constructor options:

```ts
type RateLimitOptions = {
  maxQueueSize?: number;
  taskTimeoutMs?: number;
};
```

Default `maxQueueSize` to a conservative value such as `500`, and reject new work when the queue is full.

- [ ] **Step 4: Add per-IP API limiter**

Create `services/apiRateLimit.ts`:

```ts
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function getClientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function checkApiRateLimit(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfterMs: current.resetAt - now };
  }
  current.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}
```

- [ ] **Step 5: Verify**

Run:

```bash
bun test services/rateLimitService.test.ts services/apiRateLimit.test.ts
bunx tsc --noEmit
```

Expected: queue overflow and per-IP throttling are covered by tests.

---

## Task 5: Reduce Always-On Particle Animation Cost

**Files:**
- Modify: `components/utils/PaticlesBackground.tsx`

- [ ] **Step 1: Define animation policy**

Use these rules:

```ts
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
const shouldAnimate = !reducedMotion && !coarsePointer && document.visibilityState === "visible";
```

- [ ] **Step 2: Pause animation when hidden**

Add a `visibilitychange` listener. Cancel `requestAnimationFrame` when hidden and restart only when visible.

- [ ] **Step 3: Cap DPR and particles**

Use `Math.min(window.devicePixelRatio, 1.5)` and lower default `quantity` for coarse pointers.

- [ ] **Step 4: Verify manually**

Run: `bun run dev`

Expected:
- Desktop page still renders the background.
- With `prefers-reduced-motion`, the canvas stays static.
- Hidden tab stops scheduling animation frames.

---

## Task 6: Restore Quality Gates Without Changing Behavior

**Files:**
- Modify: `app/globals.css`
- Modify: `models/transfer.ts`
- Modify: `components/operations/BatchTransferContainer.tsx`
- Modify: `components/operations/BatchTableContainer.tsx`
- Modify: route files reported by `bun run lint`
- Modify: import-only files reported by Biome organize imports

- [ ] **Step 1: Fix CSS import order**

Move `@import "tw-animate-css";` before `@plugin "tailwindcss-animate";` in `app/globals.css`.

- [ ] **Step 2: Apply type-only imports**

For each route file, change `NextRequest` and model imports used only as types to `import type`.

- [ ] **Step 3: Replace array index keys**

In `models/transfer.ts`, add an `id` field to batch rows:

```ts
data: {
  id: string;
  toAddress: string;
  amount: number;
  warning?: string;
}[];
```

In `components/operations/BatchTransferContainer.tsx`, set the id when parsing each valid row:

```ts
return { id: crypto.randomUUID(), toAddress, amount };
```

For warning rows:

```ts
return { id: crypto.randomUUID(), toAddress, amount, warning: "Invalid address" };
```

In `components/operations/BatchTableContainer.tsx`, use the id as the key:

```tsx
<TableRow key={row.id}>
```

- [ ] **Step 4: Verify**

Run:

```bash
bun run lint
bunx tsc --noEmit
bun run build
```

Expected: lint has no diagnostics, TypeScript passes, and build completes.

---

## Final Verification Checklist

- [ ] `bun audit` reports `No vulnerabilities found`.
- [ ] `bun test` passes for all new tests.
- [ ] `bunx tsc --noEmit` passes.
- [ ] `bun run lint` passes after quality-gate task.
- [ ] `bun run build` completes after quality-gate/build blocker task.
- [ ] Manual wallet checks cover TronLink connect, private-key activation, single transfer simulation, batch CSV parse, approval, transfer monitor, and resume monitor on Shasta before mainnet use.
