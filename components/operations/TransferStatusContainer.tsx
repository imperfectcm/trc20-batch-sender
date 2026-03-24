"use client";

import { useOperationStore, useSenderStore } from "@/utils/store";
import { HueLoader } from "../utils/HueLoader";
import { BatchTransferData, TransferItem } from "@/models/transfer";
import { CopyButton } from "../ui/copy-button";
import { Button } from "../ui/button";
import { useReqDebounce } from "@/hooks/useReqDebounce";
import { RefreshCw } from "lucide-react";

interface TransferStatusContainerProps {
    transferType?: "single" | "batch";
}

const TransferInfoContainer = ({ transferData, ringColor, txidColor }: { transferData: Partial<TransferItem>, ringColor?: string, txidColor?: string }) => {
    const isTransferPending = useOperationStore((state) => state.isTransferPending("single"));
    return (
        <section className={`relative transfer-status-container text-stone-300 ring-1 ${ringColor}`}>
            <div className="w-full flex flex-col gap-y-1">
                <div className={`w-full flex gap-2 ${isTransferPending && "animate-pulse"}`}>
                    <div className="flex flex-col basis-1/4">
                        <p className="text-xs text-stone-400">Network</p>
                        <p>{transferData.network}</p>
                    </div>
                    <div className="flex flex-col basis-1/2">
                        <p className="text-xs text-stone-400">Recipient Address</p>
                        <p>{transferData.toAddress}</p>
                    </div>
                    <div className="flex flex-col basis-1/4 items-end">
                        <p className="text-xs text-stone-400">Amount</p>
                        <p>{transferData.amount} {transferData.token}</p>
                    </div>
                </div>
                {!!transferData.txid && (
                    <div className="flex gap-x-1 items-center">
                        Txid: <p className={`${txidColor}`}>{transferData.txid}</p>
                        <CopyButton content={transferData.txid} size="sm" variant="ghost" />
                    </div>
                )}
                {transferData.error && (
                    <div className="flex gap-x-1 items-center">
                        Error: <p className="text-red-500 truncate">{transferData.error}</p>
                    </div>
                )}
            </div>
        </section>
    )
}

const BatchTransferInfoContainer = ({ batchTransfers, ringColor, txidColor }: { batchTransfers: Partial<BatchTransferData>, ringColor?: string, txidColor?: string }) => {
    const isTransferPending = useOperationStore((state) => state.isTransferPending("batch"));
    return (
        <section className={`relative transfer-status-container text-stone-300 ring-1 ${ringColor}`}>
            <div className="w-full flex flex-col gap-y-1">
                <div className={`w-full flex flex-col gap-2 ${isTransferPending && "animate-pulse"}`}>
                    <div className="flex flex-col">
                        <p className="text-xs text-stone-400">Network</p>
                        <p>{batchTransfers.network || "-"}</p>
                    </div>
                    <div className="w-full flex justify-between text-xs text-stone-400 gap-x-1">
                        <p>Recipient Address</p>
                        <p>Amount</p>
                    </div>
                    <div className="w-full flex flex-col gap-y-1">
                        {batchTransfers.data && batchTransfers.data.length > 0 && batchTransfers.data.map((item, i) => (
                            <div key={i} className="w-full flex justify-between text-sm gap-x-1">
                                <p>{item.toAddress}</p>
                                <p>{item.amount} {batchTransfers.token}</p>
                            </div>
                        ))}
                    </div>
                    {!!batchTransfers.txid && (
                        <div className="flex gap-x-1 items-center">
                            Txid: <p className={`${txidColor}`}>{batchTransfers.txid}</p>
                            <CopyButton content={batchTransfers.txid} size="sm" variant="ghost" />
                        </div>
                    )}
                    {batchTransfers.error && (
                        <div className="flex gap-x-1 items-center">
                            Error: <p className="text-red-500 truncate">{batchTransfers.error}</p>
                        </div>
                    )}
                </div>
            </div>
        </section >
    )
}

export const TransferStatusContainer = ({ transferType = "single" }: TransferStatusContainerProps) => {
    const privateKeyActivated = useSenderStore(state => state.active.privateKey);

    const transferData = useOperationStore(state => state.singleTransferData);
    const batchTransfers = useOperationStore(state => state.batchTransfers);

    const processStage = useOperationStore(state => state.processStage);
    const energyRental = useOperationStore(state => state.energyRental);

    const clearSingleTransfer = useOperationStore(state => state.clearSingleTransfer);
    const clearBatchTransfers = useOperationStore(state => state.clearBatchTransfers);
    const clearProcessStage = useOperationStore(state => state.clearProcessStage);
    const clearEnergyRental = useOperationStore(state => state.clearEnergyRental);

    const isTransferActive = useOperationStore((state) => state.isTransferActive);
    const isTransferPending = useOperationStore((state) => state.isTransferPending);
    const resumeTransferMonitoring = useOperationStore((state) => state.resumeTransferMonitoring);
    const resumeBatchTransferMonitoring = useOperationStore((state) => state.resumeBatchTransferMonitoring);

    const isLoading = useOperationStore((state) => state.isLoading);

    const debouncedResume = useReqDebounce("resumeTransferMonitoring", resumeTransferMonitoring);
    const handleResume = () => {
        debouncedResume(true);
    };

    const debouncedBatchResume = useReqDebounce("resumeBatchTransferMonitoring", resumeBatchTransferMonitoring);
    const handleBatchResume = () => {
        debouncedBatchResume(true);
    }

    const handleClearSingleTransfer = () => {
        clearSingleTransfer();
        clearProcessStage("single");
        clearEnergyRental();
    }

    const handleClearBatchTransfers = () => {
        clearBatchTransfers();
        clearProcessStage("batch");
        clearEnergyRental();
    }

    if (!privateKeyActivated) return null;

    const isSingle = transferType === "single";
    const stage = processStage[transferType];
    const network = isSingle ? transferData.network : batchTransfers.network;
    const handleResumeFn = isSingle ? handleResume : handleBatchResume;
    const handleClear = isSingle ? handleClearSingleTransfer : handleClearBatchTransfers;

    const visible = isSingle
        ? !isTransferPending("batch") && !!transferData.toAddress && stage !== ""
        : !isTransferPending("single") && !!batchTransfers.data?.length && stage !== "";

    if (!visible) return null;

    const InfoContainer = ({ ringColor, txidColor }: { ringColor: string; txidColor: string }) =>
        isSingle
            ? <TransferInfoContainer transferData={transferData} ringColor={ringColor} txidColor={txidColor} />
            : (
                <section className="w-full overflow-y-auto p-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                    <BatchTransferInfoContainer batchTransfers={batchTransfers} ringColor={ringColor} txidColor={txidColor} />
                </section>
            );

    return (
        <article className="relative min-h-60 max-h-[80dvh] w-full flex flex-col gap-y-2 bg-orange-100/10 p-2 rounded-lg overflow-y-auto">

            {stage === "idle" && (
                <>
                    <section className="rounded-lg p-2 bg-stone-800">
                        <p className="font-mono">Idle</p>
                    </section>
                    <InfoContainer ringColor="ring-stone-500" txidColor="text-stone-500" />
                </>
            )}

            {/* Batch-only: approving allowance */}
            {!isSingle && stage === "approving" && (
                <>
                    <section className="rounded-lg p-2 bg-yellow-500">
                        <p className="font-mono animate-pulse">Approving Allowance...</p>
                    </section>
                    <InfoContainer ringColor="ring-yellow-500" txidColor="text-yellow-500" />
                </>
            )}

            {stage === "renting-energy" && !energyRental.txid && (
                <section className="transfer-status-container ring-1 ring-amber-500">
                    <p className="animate-pulse">
                        Renting {energyRental.targetTier} energy on {network} network...
                    </p>
                </section>
            )}

            {stage === "renting-energy" && energyRental.txid && (
                <section className="transfer-status-container ring-1 ring-orange-500">
                    <div className="w-full flex flex-col">
                        <span className="w-full flex justify-between animate-pulse">
                            <p>Energy rental submitted. Waiting for energy acquisition...</p>
                            <p>30 - 90 seconds</p>
                        </span>
                        <div className="flex gap-x-1 mt-1 items-center">
                            Txid: <p className="text-orange-500">{energyRental.txid}</p>
                            <CopyButton content={energyRental.txid} size="sm" variant="ghost" />
                        </div>
                    </div>
                </section>
            )}

            {stage === "broadcasting" && (
                <>
                    <section className="rounded-lg p-2 bg-indigo-800">
                        <p className="font-mono animate-pulse">Broadcasting Transfer...</p>
                    </section>
                    <InfoContainer ringColor="ring-indigo-500" txidColor="text-indigo-500" />
                </>
            )}

            {stage === "confirming" && (
                <>
                    <section className="rounded-lg p-2 bg-sky-800">
                        <div className="w-full flex justify-between animate-pulse">
                            <p className="font-mono">Transfer Broadcasted, Monitoring Confirm Status...</p>
                            <p className="font-mono">30 - 90 seconds</p>
                        </div>
                    </section>
                    <InfoContainer ringColor="ring-sky-500" txidColor="text-sky-500" />
                </>
            )}

            {(isSingle ? ["energy-timeout", "timeout"] : ["approving-timeout", "energy-timeout", "timeout"]).includes(stage) && (
                <>
                    <section className="relative w-full flex justify-between items-center rounded-lg p-2 bg-stone-600">
                        <p className="font-mono text-stone-200">Confirmation Progress Time-out</p>
                        <Button variant="ghost" size="sm" onClick={handleResumeFn}
                            className="h-auto p-1 text-stone-400 hover:text-tangerine">
                            Resume <RefreshCw size={16} />
                        </Button>
                    </section>
                    <InfoContainer ringColor="ring-stone-400" txidColor="text-stone-400" />
                </>
            )}

            {stage === "confirmed" && (
                <>
                    <section className="rounded-lg p-2 bg-emerald-700">
                        <p className="font-mono">Transfer Confirmed</p>
                    </section>
                    <InfoContainer ringColor="ring-emerald-500" txidColor="text-emerald-500" />
                </>
            )}

            {stage === "failed" && (
                <>
                    <section className="rounded-lg p-2 bg-red-800">
                        <p className="font-mono">Transfer Failed</p>
                    </section>
                    <InfoContainer ringColor="ring-red-500" txidColor="text-red-500" />
                </>
            )}

            {["timeout", "confirmed", "failed"].includes(stage) && (
                <aside className="w-full text-center mt-4">
                    <Button variant="outline"
                        disabled={isLoading || isTransferActive(transferType)}
                        className="bg-transparent text-stone-400 hover:text-tangerine"
                        onClick={handleClear}>
                        Clear Result
                    </Button>
                </aside>
            )}

            {isLoading && (
                <aside className="-z-10 absolute top-0 left-0 w-full h-full flex justify-center items-center opacity-30">
                    <HueLoader />
                </aside>
            )}
        </article>
    );
};