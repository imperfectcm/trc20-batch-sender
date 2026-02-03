"use client";

import { useOperationStore, useSenderStore } from "@/utils/store";
import { HueLoader } from "../utils/HueLoader";
import { TransferReq } from "@/models/transfer";
import { TransferRes } from "@/models/transfer";

interface TransferStatusContainerProps {
    transferType?: "single" | "batch";
}

const TransferInfoContainer = ({ transferState, className }: { transferState: TransferReq & TransferRes, className?: string }) => {
    return (
        <section className={`transfer-status-container ${className}`}>
            <div className={`w-full flex gap-2 ${transferState.status === "pending" && "animate-pulse"}`}>
                <div className="flex flex-col basis-1/4">
                    <p>Network</p>
                    <p>{transferState.network}</p>
                </div>
                <div className="flex flex-col basis-1/2">
                    <p>Recipient Address</p>
                    <p>{transferState.toAddress}</p>
                </div>
                <div className="flex flex-col basis-1/4 items-end">
                    <p>Amount</p>
                    <p>{transferState.amount} {transferState.token}</p>
                </div>
            </div>
        </section>
    )
}

export const TransferStatusContainer = ({ transferType = "single" }: TransferStatusContainerProps) => {
    const addressActivated = useSenderStore(state => state.active.address);

    const transferState = useOperationStore(state => state.transferState);
    const processStage = useOperationStore(state => state.processStage);
    const energyRental = useOperationStore(state => state.energyRental);
    const isLoading = useOperationStore((state) => state.isLoading);

    if (!addressActivated || transferState.status === "" || processStage === "") {
        return null
    };

    if (transferType === "single") {
        return (
            <article className="relative min-h-60 max-h-[80dvh] w-full flex flex-col gap-y-2 bg-orange-100/10 p-2 rounded-lg">
                {processStage === "estimating-energy" && (
                    <section className="transfer-status-container ring-1 ring-yellow-500">
                        <p className="animate-pulse">
                            Estimating energy cost for transferring {transferState.amount} {transferState.token}...
                        </p>
                    </section>
                )}

                {processStage === "renting-energy" && !energyRental.txID && (
                    <section className="transfer-status-container ring-1 ring-amber-500">
                        <p className="animate-pulse">
                            Renting {energyRental.targetTier} energy on {transferState.network} network...
                        </p>
                    </section>
                )}

                {processStage === "renting-energy" && energyRental.txID && (
                    <section className="transfer-status-container ring-1 ring-orange-500">
                        <div>
                            <p className="animate-pulse">
                                Energy rental submitted. Transaction (TXID: {energyRental.txID})
                            </p>
                            <p className="animate-pulse">
                                Waiting for energy acquisition...
                            </p>
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
                        <TransferInfoContainer transferState={transferState} className="ring-1 ring-indigo-500" />
                    </>
                )}

                {processStage === "confirming" && (
                    <>
                        <section className="rounded-lg p-2 bg-sky-800">
                            <p className="font-mono">
                                Transfer broadcasted, monitoring confirm status...
                            </p>
                        </section>
                        <TransferInfoContainer transferState={transferState} className="ring-1 ring-sky-500" />
                    </>
                )}

                {processStage === "confirmed" && (
                    <>
                        <section className="rounded-lg p-2 bg-teal-800">
                            <p className="font-mono">
                                Transfer confirmed
                            </p>
                        </section>
                        <TransferInfoContainer transferState={transferState} className="ring-1 ring-teal-500" />
                    </>
                )}

                {processStage === "failed" && (
                    <>
                        <section className="rounded-lg p-2 bg-red-800">
                            <p className="font-mono">
                                Transfer failed
                            </p>
                        </section>
                        <TransferInfoContainer transferState={transferState} className="ring-1 ring-red-500" />
                    </>
                )}

                {!isLoading &&
                    <aside className="-z-10 absolute top-0 left-0 w-full h-full flex justify-center items-center opacity-30">
                        <HueLoader />
                    </aside>
                }
            </article >
        );
    }


};