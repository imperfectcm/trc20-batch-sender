"use client";

import { useOperationStore, useSenderStore } from "@/utils/store";
import { HueLoader } from "../utils/HueLoader";
import { BatchTransferData, TransferItem } from "@/models/transfer";
import { CopyButton } from "../ui/copy-button";
import { Button } from "../ui/button";
import { useEffect } from "react";
import { useReqDebounce } from "@/hooks/useReqDebounce";
import { RefreshCw } from "lucide-react";

interface TransferStatusContainerProps {
    transferType?: "single" | "batch";
}

const TransferInfoContainer = ({ transferData, ringColor, txidColor }: { transferData: Partial<TransferItem>, ringColor?: string, txidColor?: string }) => {
    return (
        <section className={`relative transfer-status-container text-stone-300 ring-1 ${ringColor}`}>
            <div className="w-full flex flex-col gap-y-1">
                <div className={`w-full flex gap-2 ${transferData.status === "pending" && "animate-pulse"}`}>
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
    return (
        <section className={`relative transfer-status-container text-stone-300 ring-1 ${ringColor}`}>
            <div className="w-full flex flex-col gap-y-1">
                <div className={`w-full flex flex-col gap-2 ${batchTransfers.status === "pending" && "animate-pulse"}`}>
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
    const addressActivated = useSenderStore(state => state.active.address);

    const transferData = useOperationStore(state => state.singleTransferData);
    const batchTransfers = useOperationStore(state => state.batchTransfers);

    const processStage = useOperationStore(state => state.processStage);
    const energyRental = useOperationStore(state => state.energyRental);

    const clearSingleTransfer = useOperationStore(state => state.clearSingleTransfer);
    const clearBatchTransfers = useOperationStore(state => state.clearBatchTransfers);
    const clearProcessStage = useOperationStore(state => state.clearProcessStage);
    const clearEnergyRental = useOperationStore(state => state.clearEnergyRental);

    const isSingleTransfering = useOperationStore((state) => state.isSingleTransfering());
    const isBatchTransfering = useOperationStore((state) => state.isBatchTransfering());

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

    if (!addressActivated) {
        return null
    };

    if (transferType === "single" && !isBatchTransfering && !!transferData.toAddress && processStage.single !== "") {
        return (
            <article className="relative min-h-60 max-h-[80dvh] w-full flex flex-col gap-y-2 bg-orange-100/10 p-2 rounded-lg">
                {processStage.single === "standby" && (
                    <>
                        <section className="rounded-lg p-2 bg-stone-800">
                            <div className="flex">
                                <p className="font-mono">Standby</p>
                            </div>
                        </section>
                        <TransferInfoContainer transferData={transferData} ringColor="ring-stone-500" txidColor="text-stone-500" />
                    </>
                )}

                {processStage.single === "renting-energy" && !energyRental.txid && (
                    <section className="transfer-status-container ring-1 ring-amber-500">
                        <p className="animate-pulse">
                            Renting {energyRental.targetTier} energy on {transferData.network} network...
                        </p>
                    </section>
                )}

                {processStage.single === "renting-energy" && energyRental.txid && (
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

                {processStage.single === "broadcasting" && (
                    <>
                        <section className="rounded-lg p-2 bg-indigo-800">
                            <p className="font-mono animate-pulse">Broadcasting Transfer...</p>
                        </section>
                        <TransferInfoContainer transferData={transferData} ringColor="ring-indigo-500" txidColor="text-indigo-500" />
                    </>
                )}

                {processStage.single === "confirming" && (
                    <>
                        <section className="rounded-lg p-2 bg-sky-800">
                            <div className="w-full flex justify-between animate-pulse">
                                <p className="font-mono">Transfer Broadcasted, Monitoring Confirm Status...</p>
                                <p className="font-mono">30 - 90 seconds</p>
                            </div>
                        </section>
                        <TransferInfoContainer transferData={transferData} ringColor="ring-sky-500" txidColor="text-sky-500" />
                    </>
                )}

                {(processStage.single === "energy-timeout" || processStage.single === "timeout") && (
                    <>
                        <section className="relative w-full flex justify-between items-center rounded-lg p-2 bg-stone-600">
                            <p className="font-mono text-stone-200">
                                Confirmation Progress Time-out
                            </p>
                            <div>
                                <Button variant="ghost" size="sm" onClick={handleResume}
                                    className="h-auto p-1 text-stone-400 hover:text-tangerine">
                                    Resume <RefreshCw size={16} />
                                </Button>
                            </div>
                        </section>
                        <TransferInfoContainer transferData={transferData} ringColor="ring-stone-400" txidColor="text-stone-400" />
                    </>
                )}

                {processStage.single === "confirmed" && (
                    <>
                        <section className="rounded-lg p-2 bg-emerald-700">
                            <p className="font-mono">
                                Transfer Confirmed
                            </p>
                        </section>
                        <TransferInfoContainer transferData={transferData} ringColor="ring-emerald-500" txidColor="text-emerald-500" />
                    </>
                )}

                {processStage.single === "failed" && (
                    <>
                        <section className="rounded-lg p-2 bg-red-800">
                            <p className="font-mono">
                                Transfer Failed
                            </p>
                        </section>
                        <TransferInfoContainer transferData={transferData} ringColor="ring-red-500" txidColor="text-red-500" />
                    </>
                )}

                {["timeout", "confirmed", "failed"].includes(processStage.single) &&
                    <aside className="w-full text-center mt-4">
                        <Button variant="outline"
                            disabled={isLoading || transferData.status === "pending"}
                            className="bg-transparent text-stone-400 hover:text-tangerine"
                            onClick={handleClearSingleTransfer}>
                            Clear Result
                        </Button>
                    </aside>
                }

                {isLoading &&
                    <aside className="-z-10 absolute top-0 left-0 w-full h-full flex justify-center items-center opacity-30">
                        <HueLoader />
                    </aside>
                }
            </article >
        );
    }

    if (transferType === "batch" && !isSingleTransfering && batchTransfers.data && batchTransfers.data.length > 0 && processStage.batch !== "") {
        return (
            <article className="relative min-h-60 max-h-[80dvh] w-full flex flex-col gap-y-2 bg-orange-100/10 p-2 rounded-lg">
                {processStage.batch === "standby" && (
                    <>
                        <section className="rounded-lg p-2 bg-stone-800">
                            <div className="flex">
                                <p className="font-mono">Standby</p>
                            </div>
                        </section>
                        <BatchTransferInfoContainer batchTransfers={batchTransfers} ringColor="ring-stone-500" txidColor="text-stone-500" />
                    </>
                )}

                {processStage.batch === "renting-energy" && !energyRental.txid && (
                    <section className="transfer-status-container ring-1 ring-amber-500">
                        <p className="animate-pulse">
                            Renting {energyRental.targetTier} energy on {batchTransfers.network} network...
                        </p>
                    </section>
                )}

                {processStage.batch === "renting-energy" && energyRental.txid && (
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

                {processStage.batch === "broadcasting" && (
                    <>
                        <section className="rounded-lg p-2 bg-indigo-800">
                            <p className="font-mono animate-pulse">Broadcasting Transfer...</p>
                        </section>
                        <BatchTransferInfoContainer batchTransfers={batchTransfers} ringColor="ring-indigo-500" txidColor="text-indigo-500" />
                    </>
                )}

                {processStage.batch === "confirming" && (
                    <>
                        <section className="rounded-lg p-2 bg-sky-800">
                            <div className="w-full flex justify-between animate-pulse">
                                <p className="font-mono">Transfer Broadcasted, Monitoring Confirm Status...</p>
                                <p className="font-mono">30 - 90 seconds</p>
                            </div>
                        </section>
                        <BatchTransferInfoContainer batchTransfers={batchTransfers} ringColor="ring-sky-500" txidColor="text-sky-500" />
                    </>
                )}

                {(processStage.batch === "energy-timeout" || processStage.batch === "timeout") && (
                    <>
                        <section className="relative w-full flex justify-between items-center rounded-lg p-2 bg-stone-600">
                            <p className="font-mono text-stone-200">
                                Confirmation Progress Time-out
                            </p>
                            <div>
                                <Button variant="ghost" size="sm" onClick={handleBatchResume}
                                    className="h-auto p-1 text-stone-400 hover:text-tangerine">
                                    Resume <RefreshCw size={16} />
                                </Button>
                            </div>
                        </section>
                        <BatchTransferInfoContainer batchTransfers={batchTransfers} ringColor="ring-stone-400" txidColor="text-stone-400" />
                    </>
                )}

                {processStage.batch === "confirmed" && (
                    <>
                        <section className="rounded-lg p-2 bg-emerald-700">
                            <p className="font-mono">
                                Transfer Confirmed
                            </p>
                        </section>
                        <BatchTransferInfoContainer batchTransfers={batchTransfers} ringColor="ring-emerald-500" txidColor="text-emerald-500" />
                    </>
                )}

                {processStage.batch === "failed" && (
                    <>
                        <section className="rounded-lg p-2 bg-red-800">
                            <p className="font-mono">
                                Transfer Failed
                            </p>
                        </section>
                        <BatchTransferInfoContainer batchTransfers={batchTransfers} ringColor="ring-red-500" txidColor="text-red-500" />
                    </>
                )}

                {["timeout", "confirmed", "failed"].includes(processStage.batch) &&
                    <aside className="w-full text-center mt-4">
                        <Button variant="outline"
                            disabled={isLoading || batchTransfers.status === "pending"}
                            className="bg-transparent text-stone-400 hover:text-tangerine"
                            onClick={handleClearBatchTransfers}>
                            Clear Result
                        </Button>
                    </aside>
                }

                {isLoading &&
                    <aside className="-z-10 absolute top-0 left-0 w-full h-full flex justify-center items-center opacity-30">
                        <HueLoader />
                    </aside>
                }
            </article>

        )
    }

    return null;
};