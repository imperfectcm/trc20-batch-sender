import type { TronLinkAdapter } from '@tronweb3/tronwallet-adapters';
import type { PollTxResult } from '@/models/transfer';
import TronFrontendService from '@/services/frontend/tronService';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

declare function beforeEach(fn: () => void): void;
declare function afterEach(fn: () => void): void;
declare function afterAll(fn: () => void): void;
declare function test(name: string, fn: () => void | Promise<void>): void;
declare function expect<T>(actual: T): { toBe(expected: T): void };

const storage = new Map<string, string>();
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
} });
const { useOperationStore: ops, useSenderStore: sender } = await import('./store');
const { BatchTransferContainer } = await import('@/components/operations/BatchTransferContainer');
const { TransferStatusContainer } = await import('@/components/operations/TransferStatusContainer');
const { OperationTabsContainer } = await import('@/components/operations/OperationTabsContainer');
const originalFetch = globalThis.fetch;
const initialSnapshots = { sender: { ...sender.getInitialState() }, ops: { ...ops.getInitialState() } };
const proto = TronFrontendService.prototype;
const originals = {
    pollTx: proto.pollTx, singleTransfer: proto.singleTransfer, batchTransfer: proto.batchTransfer,
    checkAllowance: proto.checkAllowance, approveBatchTransfer: proto.approveBatchTransfer,
};
let result: PollTxResult;
let submissions = 0;
let queries: string[];
const address = 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj';

beforeEach(() => {
    result = { status: 'unknown', reason: 'RPC unavailable' };
    submissions = 0; queries = [];
    proto.pollTx = async ({ txid }) => { queries.push(txid); return result; };
    proto.singleTransfer = proto.batchTransfer = async () => { submissions++; return { txid: 'payment-tx' }; };
    proto.checkAllowance = async () => ({ sufficient: false, totalAmount: '1000000' });
    proto.approveBatchTransfer = async () => { submissions++; return { txid: 'approval-tx' }; };
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        if (String(input) !== '/api/validation/address') throw new Error('Unexpected API request');
        return new Response(JSON.stringify({ success: true, data: true }));
    }) as typeof fetch;
    sender.setState({ network: 'mainnet', address, privateKey: '', active: { address: true, privateKey: true },
        adapter: { connected: true, address } as TronLinkAdapter });
    ops.setState({ isLoading: false, processStage: { single: '', batch: '' }, stoppedTransfers: [],
        energyRental: { enable: false, isMonitoring: false },
        singleTransferData: { network: 'mainnet', fromAddress: address, toAddress: address, amount: 1, token: 'USDT' },
        batchTransfers: { network: 'mainnet', fromAddress: address, token: 'USDT', data: [{ toAddress: address, amount: 1 }] },
    });
});
afterEach(() => {
    Object.assign(proto, originals); globalThis.fetch = originalFetch;
    Object.assign(sender.getInitialState(), initialSnapshots.sender);
    Object.assign(ops.getInitialState(), initialSnapshots.ops);
});
afterAll(() => {
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
});

for (const type of ['single', 'batch'] as const) {
    for (const outcome of [
        { status: 'confirmed' }, { status: 'timeout' },
        { status: 'failed', reason: 'REVERT' }, { status: 'unknown', reason: 'RPC unavailable' },
    ] as PollTxResult[]) {
        test(`${type}: initial and resumed ${outcome.status} preserve the payment result`, async () => {
            result = outcome;
            const expected = outcome.status === 'unknown' ? 'confirmation-unknown' : outcome.status;
            await (type === 'single' ? ops.getState().singleTransferFlow() : ops.getState().batchTransferFlow());
            expect(ops.getState().processStage[type]).toBe(expected);
            expect(submissions).toBe(1);
            ops.getState().updateProcess({ [type]: 'confirmation-unknown' });
            await (type === 'single' ? ops.getState().resumeTransferMonitoring(true) : ops.getState().resumeBatchTransferMonitoring(true));
            expect(ops.getState().processStage[type]).toBe(expected);
            expect(submissions).toBe(1);
            expect(queries.join(',')).toBe('payment-tx,payment-tx');
        });
    }

    test(`${type}: unknown payment survives reload, cannot be cleared or resent`, async () => {
        await (type === 'single' ? ops.getState().singleTransferFlow() : ops.getState().batchTransferFlow());
        const saved = storage.get('op-store')!;
        ops.setState({ processStage: { single: '', batch: '' } });
        storage.set('op-store', saved);
        await ops.persist.rehydrate();
        expect(ops.getState().processStage[type]).toBe('confirmation-unknown');
        expect(ops.getState().canClearTransfer(type)).toBe(false);
        ops.getState().clearProcessStage(type);
        if (type === 'single') ops.getState().clearSingleTransfer();
        else {
            ops.getState().clearBatchTransfers();
            ops.getState().setBatchTransfers({ data: [] });
        }
        expect(ops.getState().processStage[type]).toBe('confirmation-unknown');
        expect((type === 'single' ? ops.getState().singleTransferData : ops.getState().batchTransfers).txid).toBe('payment-tx');
        await ops.getState().simulateSingleTransfer();
        await ops.getState().simulateBatchTransfer();
        await ops.getState().singleTransferFlow();
        await ops.getState().batchTransferFlow();
        expect(await ops.getState().approveBatchTransfer()).toBe(false);
        await (type === 'single' ? ops.getState().resumeTransferMonitoring() : ops.getState().resumeBatchTransferMonitoring());
        expect(submissions).toBe(1);
        expect(queries.join(',')).toBe('payment-tx,payment-tx');
    });
}

test('approval unknown and timeout remain approvals on Resume, never completed payments', async () => {
    expect(await ops.getState().approveBatchTransfer()).toBe(false);
    expect(ops.getState().processStage.batch).toBe('approving-unknown');
    result = { status: 'timeout' };
    await ops.getState().resumeBatchTransferMonitoring(true);
    expect(ops.getState().processStage.batch).toBe('approving-timeout');
    expect(ops.getState().isTransferPending('batch')).toBe(true);
    result = { status: 'confirmed' };
    await ops.getState().resumeBatchTransferMonitoring(true);
    expect(ops.getState().processStage.batch).toBe('idle');
    expect(ops.getState().batchTransfers.txid).toBe(undefined);
    expect(queries.join(',')).toBe('approval-tx,approval-tx,approval-tx');
    expect(submissions).toBe(1);
});

test('changing accounts does not erase an unknown payment', async () => {
    ops.getState().updateProcess({ batch: 'confirmation-unknown' });
    ops.getState().updateBatchTransfers({ txid: 'payment-tx' });
    sender.setState({ address: 'different-account' });
    await ops.getState().resumeBatchTransferMonitoring();
    expect(ops.getState().processStage.batch).toBe('confirmation-unknown');
    expect(ops.getState().batchTransfers.txid).toBe('payment-tx');
    expect(queries.length).toBe(0);
});

test('stopped pre-payment tasks can be explicitly cleared; pending payments stay locked', () => {
    for (const stage of ['energy-timeout', 'estimating-energy'] as const) {
        ops.getState().updateProcess({ batch: stage });
        expect(ops.getState().canClearTransfer('batch')).toBe(true);
        ops.getState().clearBatchTransfers();
        ops.getState().clearProcessStage('batch');
        expect(ops.getState().processStage.batch).toBe('');
    }
    ops.getState().updateBatchTransfers({ txid: 'payment-tx' });
    for (const stage of ['timeout', 'confirmation-unknown', 'approving-timeout', 'approving-unknown'] as const) {
        ops.getState().updateProcess({ batch: stage });
        expect(ops.getState().canClearTransfer('batch')).toBe(false);
        ops.getState().clearBatchTransfers();
        ops.getState().clearProcessStage('batch');
        expect(ops.getState().processStage.batch).toBe(stage);
    }
});

test('unknown payment UI offers query recovery and disables Clear List and Preview', () => {
    ops.getState().updateProcess({ batch: 'confirmation-unknown' });
    ops.getState().updateBatchTransfers({ txid: 'payment-tx' });
    // Server rendering reads Zustand's initial snapshot rather than its live state.
    Object.assign(sender.getInitialState(), sender.getState());
    Object.assign(ops.getInitialState(), ops.getState());
    const html = renderToStaticMarkup(createElement(BatchTransferContainer));
    expect(html.includes('Transaction result unknown')).toBe(true);
    expect(html.includes('payment-tx')).toBe(true);
    expect(html.includes('Check Again')).toBe(true);
    expect(html.includes('Clear Result')).toBe(false);
    const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)!;
    expect(buttons.find(button => button.includes('Clear List'))!.includes('disabled=""')).toBe(true);
    expect(buttons.find(button => button.includes('Preview'))!.includes('disabled=""')).toBe(true);
});

test('energy timeout UI preserves rental Txid and allows explicit clearing before payment', () => {
    ops.getState().updateProcess({ batch: 'energy-timeout' });
    ops.getState().setEnergyRental({ txid: 'rental-tx' });
    Object.assign(sender.getInitialState(), sender.getState());
    Object.assign(ops.getInitialState(), ops.getState());
    const html = renderToStaticMarkup(createElement(TransferStatusContainer, { transferType: 'batch' }));
    expect(html.includes('Energy acquisition timed out')).toBe(true);
    expect(html.includes('rental-tx')).toBe(true);
    const clear = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)!.find(button => button.includes('Clear Result'))!;
    expect(clear.includes('disabled=""')).toBe(false);
});

for (const type of ['single', 'batch'] as const) {
    test(`${type}: energy recovery displays a persistent notice without sending a payment`, async () => {
        sender.setState({ profile: { energy: 100 } });
        ops.getState().updateProcess({ [type]: 'energy-timeout' });
        ops.getState().setEnergyRental({ targetTier: 100, txid: 'rental-tx' });
        const originalInterval = globalThis.setInterval;
        globalThis.setInterval = ((callback: () => void) => originalInterval(callback, 1)) as typeof setInterval;
        try {
            await (type === 'single' ? ops.getState().resumeTransferMonitoring(true) : ops.getState().resumeBatchTransferMonitoring(true));
        } finally {
            globalThis.setInterval = originalInterval;
        }
        expect(ops.getState().processStage[type]).toBe('idle');
        expect(submissions).toBe(0);
        expect(queries.length).toBe(0);
        const saved = storage.get('op-store')!;
        ops.setState({ singleTransferData: {}, batchTransfers: {} });
        storage.set('op-store', saved);
        await ops.persist.rehydrate();
        Object.assign(sender.getInitialState(), sender.getState());
        Object.assign(ops.getInitialState(), ops.getState());
        const html = renderToStaticMarkup(createElement(TransferStatusContainer, { transferType: type }));
        expect(html.includes(type === 'batch' ? 'No batch transfer has been sent.' : 'No transfer has been sent.')).toBe(true);
        expect(html.includes('Click Preview, then Send to continue.')).toBe(true);
        if (type === 'single') ops.getState().clearSingleTransfer();
        else ops.getState().clearBatchTransfers();
        expect((type === 'single' ? ops.getState().singleTransferData : ops.getState().batchTransfers).notice).toBe(undefined);
    });
}

test('timed-out payment offers an explicit stop-tracking action', () => {
    ops.getState().updateProcess({ batch: 'timeout' });
    ops.getState().updateBatchTransfers({ txid: 'payment-tx' });
    Object.assign(sender.getInitialState(), sender.getState());
    Object.assign(ops.getInitialState(), ops.getState());
    const html = renderToStaticMarkup(createElement(TransferStatusContainer, { transferType: 'batch' }));
    expect(html.includes('Stop Tracking')).toBe(true);
});

for (const type of ['single', 'batch'] as const) {
    for (const status of ['timeout', 'unknown'] as const) {
        test(`${type}: ${status} can be explicitly stopped with CANCEL, archived, and reset without resending`, async () => {
            result = status === 'timeout' ? { status } : { status, reason: 'RPC unavailable' };
            await (type === 'single' ? ops.getState().singleTransferFlow() : ops.getState().batchTransferFlow());
            const other = type === 'single' ? ops.getState().batchTransfers : ops.getState().singleTransferData;
            expect(ops.getState().canStopTransferTracking(type)).toBe(true);
            for (const confirmation of ['', 'cancel', 'CANCEL ', ' CANCEL']) {
                expect(ops.getState().stopTransferTracking(type, confirmation)).toBe(false);
            }
            expect(ops.getState().isTransferPending(type)).toBe(true);
            expect(ops.getState().stoppedTransfers.length).toBe(0);
            expect(ops.getState().stopTransferTracking(type, 'CANCEL')).toBe(true);
            expect(ops.getState().stopTransferTracking(type, 'CANCEL')).toBe(false);
            expect(ops.getState().processStage[type]).toBe('');
            expect(ops.getState().isTransferPending(type)).toBe(false);
            const data = type === 'single' ? ops.getState().singleTransferData : ops.getState().batchTransfers;
            expect(data.txid).toBe(undefined);
            expect(type === 'single' ? ops.getState().singleTransferData.amount : ops.getState().batchTransfers.data?.length).toBe(0);
            expect(type === 'single' ? ops.getState().batchTransfers : ops.getState().singleTransferData).toBe(other);
            const record = ops.getState().stoppedTransfers[0];
            expect(record.txid).toBe('payment-tx');
            expect(record.phase).toBe('transfer');
            expect(record.network).toBe('mainnet');
            expect(record.recipients[0].amount).toBe(1);
            expect(record.recipients[0].toAddress).toBe(address);
            const saved = storage.get('op-store')!;
            ops.setState({ stoppedTransfers: [] });
            storage.set('op-store', saved);
            await ops.persist.rehydrate();
            expect(ops.getState().stoppedTransfers[0].txid).toBe('payment-tx');
            await ops.getState().resumeTransferMonitoring();
            await ops.getState().resumeBatchTransferMonitoring();
            await ops.getState().resumeTransferMonitoring(true);
            await ops.getState().resumeBatchTransferMonitoring(true);
            expect(submissions).toBe(1);
            expect(queries.join(',')).toBe('payment-tx');
        });
    }
}

test('stopping an approval preserves its phase and strips credentials from the stored record', async () => {
    await ops.getState().approveBatchTransfer();
    ops.getState().updateBatchTransfers({ privateKey: 'test-only-credential' });
    expect(ops.getState().stopTransferTracking('batch', 'CANCEL')).toBe(true);
    const record = ops.getState().stoppedTransfers[0];
    expect(record.phase).toBe('approval');
    expect(record.txid).toBe('approval-tx');
    expect(JSON.stringify(record).includes('privateKey')).toBe(false);
    expect(storage.get('op-store')!.includes('test-only-credential')).toBe(false);
    expect(ops.getState().processStage.batch).toBe('');
});

test('an in-flight confirmation cannot be reset even with CANCEL', async () => {
    let resolveQuery!: (value: PollTxResult) => void;
    let queryStarted!: () => void;
    const started = new Promise<void>(resolve => { queryStarted = resolve; });
    proto.pollTx = () => {
        queryStarted();
        return new Promise(resolve => { resolveQuery = resolve; });
    };
    const pending = ops.getState().batchTransferFlow();
    await started;
    expect(ops.getState().isLoading).toBe(true);
    expect(ops.getState().stopTransferTracking('batch', 'CANCEL')).toBe(false);
    expect(ops.getState().batchTransfers.txid).toBe('payment-tx');
    expect(ops.getState().stoppedTransfers.length).toBe(0);
    resolveQuery({ status: 'timeout' });
    await pending;
    expect(ops.getState().canStopTransferTracking('batch')).toBe(true);
});

test('stopping one task retains another pending task and its energy context', () => {
    ops.getState().updateProcess({ single: 'confirmation-unknown', batch: 'timeout' });
    ops.getState().updateSingleTransfer({ txid: 'other-payment' });
    ops.getState().updateBatchTransfers({ txid: 'payment-tx' });
    ops.getState().setEnergyRental({ txid: 'other-rental', targetTier: 100 });
    expect(ops.getState().stopTransferTracking('batch', 'CANCEL')).toBe(true);
    expect(ops.getState().processStage.single).toBe('confirmation-unknown');
    expect(ops.getState().singleTransferData.txid).toBe('other-payment');
    expect(ops.getState().energyRental.txid).toBe('other-rental');
});

test('stopped transaction remains visible below the tabs after form reset and reload', async () => {
    await ops.getState().batchTransferFlow();
    expect(ops.getState().stopTransferTracking('batch', 'CANCEL')).toBe(true);
    const saved = storage.get('op-store')!;
    ops.setState({ stoppedTransfers: [] });
    storage.set('op-store', saved);
    await ops.persist.rehydrate();
    Object.assign(sender.getInitialState(), sender.getState());
    Object.assign(ops.getInitialState(), ops.getState());
    const html = renderToStaticMarkup(createElement(OperationTabsContainer));
    expect(html.includes('Stopped Tracking (1)')).toBe(true);
    expect(html.includes('payment-tx')).toBe(true);
    expect(html.includes('mainnet')).toBe(true);
    expect(html.includes('1 USDT')).toBe(true);
    expect(ops.getState().batchTransfers.data?.length).toBe(0);
    expect(queries.length).toBe(1);
    expect(submissions).toBe(1);
});
