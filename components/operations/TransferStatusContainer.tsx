"use client";

import { useOperationStore, useSenderStore } from "@/utils/store";
import { HueLoader } from "../utils/HueLoader";
import { TransferItem } from "@/models/transfer";
import { CopyButton } from "../ui/copy-button";
import { Button } from "../ui/button";
import { useEffect } from "react";

interface TransferStatusContainerProps {
    transferType?: "single" | "batch";
}

const TransferInfoContainer = ({ transferData, ringColor, txidColor }: { transferData: Partial<TransferItem>, ringColor?: string, txidColor?: string }) => {
    return (
        <section className={`transfer-status-container text-stone-300 ring-1 ${ringColor}`}>
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
                {transferData.txid && (
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

export const TransferStatusContainer = ({ transferType = "single" }: TransferStatusContainerProps) => {
    const addressActivated = useSenderStore(state => state.active.address);

    const transferData = useOperationStore(state => state.singleTransferData);
    const processStage = useOperationStore(state => state.processStage);
    const energyRental = useOperationStore(state => state.energyRental);
    const clearSingleTransfer = useOperationStore(state => state.clearSingleTransfer);
    const clearProcessStage = useOperationStore(state => state.clearProcessStage);
    const isLoading = useOperationStore((state) => state.isLoading);
    const resumeTransferMonitoring = useOperationStore((state) => state.resumeTransferMonitoring);

    useEffect(() => {
        resumeTransferMonitoring();
    }, [resumeTransferMonitoring]);

    const handleClearSingleTransfer = () => {
        clearSingleTransfer();
        clearProcessStage();
    }

    if (!addressActivated || transferData.status === "standby" || processStage === "") {
        return null
    };

    if (transferType === "single") {
        return (
            <article className="relative min-h-60 max-h-[80dvh] w-full flex flex-col gap-y-2 bg-orange-100/10 p-2 rounded-lg">
                {processStage === "estimating-energy" && (
                    <section className="transfer-status-container ring-1 ring-yellow-500">
                        <p className="animate-pulse">
                            Estimating energy cost for transferring {transferData.amount} {transferData.token}...
                        </p>
                    </section>
                )}

                {processStage === "renting-energy" && !energyRental.txid && (
                    <section className="transfer-status-container ring-1 ring-amber-500">
                        <p className="animate-pulse">
                            Renting {energyRental.targetTier} energy on {transferData.network} network...
                        </p>
                    </section>
                )}

                {!(processStage === "renting-energy") && energyRental.txid && (
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

                {processStage === "broadcasting" && (
                    <>
                        <section className="rounded-lg p-2 bg-indigo-800">
                            <p className="font-mono">
                                Broadcasting transfer...
                            </p>
                        </section>
                        <TransferInfoContainer transferData={transferData} ringColor="ring-indigo-500" txidColor="text-indigo-500" />
                    </>
                )}

                {processStage === "confirming" && (
                    <>
                        <section className="rounded-lg p-2 bg-sky-800">
                            <div className="w-full flex justify-between">
                                <p className="font-mono">Transfer broadcasted, monitoring confirm status...</p>
                                <p className="font-mono">30 - 90 seconds</p>
                            </div>
                        </section>
                        <TransferInfoContainer transferData={transferData} ringColor="ring-sky-500" txidColor="text-sky-500" />
                    </>
                )}

                {processStage === "confirmed" && (
                    <>
                        <section className="rounded-lg p-2 bg-emerald-700">
                            <p className="font-mono">
                                Transfer confirmed
                            </p>
                        </section>
                        <TransferInfoContainer transferData={transferData} ringColor="ring-emerald-500" txidColor="text-emerald-500" />
                    </>
                )}

                {processStage === "failed" && (
                    <>
                        <section className="rounded-lg p-2 bg-red-800">
                            <p className="font-mono">
                                Transfer failed
                            </p>
                        </section>
                        <TransferInfoContainer transferData={transferData} ringColor="ring-red-500" txidColor="text-red-500" />
                    </>
                )}

                <aside className="w-full text-center mt-4">
                    <Button variant="outline"
                        disabled={isLoading || transferData.status === "pending"}
                        className="hover:bg-tangerine/40 bg-transparent text-stone-50"
                        onClick={handleClearSingleTransfer}>
                        Clear Result
                    </Button>
                </aside>

                {isLoading &&
                    <aside className="-z-10 absolute top-0 left-0 w-full h-full flex justify-center items-center opacity-30">
                        <HueLoader />
                    </aside>
                }
            </article >
        );
    }


};