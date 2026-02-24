"use client";

import { useOperationStore, useSenderStore } from "@/utils/store";
import { Button } from "../ui/button";
import { CheckCheck, Download, ReplaceAll, SendHorizontal, X } from "lucide-react";
import CSVDropzone from "../utils/DropZone";
import { toast } from "sonner";
import { BatchTableContainer } from "./BatchTableContainer";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useReqDebounce } from "@/hooks/useReqDebounce";
import { Spinner } from "../ui/spinner";
import { TransferStatusContainer } from "./TransferStatusContainer";
import { useEffect } from "react";

export const BatchTransferContainer = () => {
    const network = useSenderStore(state => state.network);
    const fromAddress = useSenderStore(state => state.address);
    const privateKey = useSenderStore(state => state.privateKey);
    const privateKeyActivated = useSenderStore(state => state.active.privateKey);

    const validateAddress = useOperationStore(state => state.validateAddress);
    const energyRental = useOperationStore(state => state.energyRental);
    const setEnergyRental = useOperationStore(state => state.setEnergyRental);

    const updateProcess = useOperationStore(state => state.updateProcess);

    const setBatchTransfers = useOperationStore(state => state.setBatchTransfers);
    const updateBatchTransfers = useOperationStore(state => state.updateBatchTransfers);
    const transfers = useOperationStore(state => state.batchTransfers);

    const approveTransfer = useOperationStore(state => state.approveBatchTransfer);
    const simulateTransfer = useOperationStore(state => state.simulateBatchTransfer);
    const transferFlow = useOperationStore((state) => state.batchTransferFlow);
    // const resumeMonitoring = useOperationStore((state) => state.resumeBatchTransferMonitoring);

    const clearProcessStage = useOperationStore(state => state.clearProcessStage);
    const clearTransfers = useOperationStore(state => state.clearBatchTransfers);
    const isTransferActive = useOperationStore(state => state.isTransferActive);
    const isLoading = useOperationStore((state) => state.isLoading);

    const disabled = isLoading || isTransferActive("single") || isTransferActive("batch");

    const MAX_BATCH_SIZE = 100;
    const handleUpload = async (data: { header?: string[]; data: unknown[] }) => {
        const expectedHeaders = ["Recipient_Address", "USDT"];
        if (!data.header?.every((word, i) => word === expectedHeaders[i])) {
            toast.warning("CSV header is incorrect. Ensure it matches the sample format.");
            return;
        }
        if (data.data.length > MAX_BATCH_SIZE) {
            toast.warning(`CSV file exceeds the maximum batch size of ${MAX_BATCH_SIZE}.`);
            return;
        }
        if (!Array.isArray(data.data) || data.data.length === 0) {
            toast.warning("CSV file is empty or not properly formatted.");
            return;
        }

        try {
            const parsingPromises = data.data
                .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
                .map(async (row) => {
                    try {
                        const rawAddress = row["Recipient_Address"];
                        const rawAmount = row["USDT"];

                        const toAddress = String(rawAddress || "").trim();
                        if (!toAddress) return null;

                        const amountStr = String(rawAmount || "").replace(/,/g, "");
                        const amount = parseFloat(amountStr);

                        const isValidAddr = await validateAddress(toAddress);
                        if (!isValidAddr) {
                            return { toAddress, amount, warning: "Invalid address" };
                        }

                        const isValidAmount = !Number.isNaN(amount) && amount > 0;
                        if (!isValidAmount) {
                            return { toAddress, amount, warning: "Invalid amount" };
                        }

                        return { toAddress, amount };
                    } catch (error) {
                        console.error("Failed to parsing row:", error);
                        return null;
                    }
                })
            const parsedData = await Promise.all(parsingPromises);
            const validData = parsedData.filter((item): item is { toAddress: string; amount: number; warning?: string } => item !== null);
            if (validData.length > 0) clearProcessStage("batch");
            const hasWarnings = validData.some(item => item.warning);

            setBatchTransfers({
                fromAddress,
                privateKey,
                token: "USDT",
                txid: undefined,
                error: undefined,
                data: validData
            });
            updateProcess({ batch: hasWarnings ? "failed" : "idle" });
        } catch (error) {
            toast.error("Error parsing CSV data. Please check the file format.");
            updateProcess({ batch: "failed" });
            updateBatchTransfers({ error: "Failed to parsing CSV data" });
            return;
        }
    }

    const handleTriggleEnergyRental = () => {
        setEnergyRental({ ...energyRental, enable: !energyRental.enable });
    }

    const previewTransfer = async () => {
        const approved = await approveTransfer();
        if (!approved) return;
        await simulateTransfer();
    };
    const debouncedPreview = useReqDebounce("previewBatchTransfer", previewTransfer);
    const handlePreview = async () => {
        await debouncedPreview();
    };

    // useEffect(() => {
    //     if (privateKeyActivated) {
    //         resumeMonitoring();
    //     };
    // }, [privateKeyActivated, resumeMonitoring]);

    if (!privateKeyActivated) {
        return (
            <div className="w-full flex flex-col gap-y-4">
                <p className="w-full text-center text-sm text-stone-400" >
                    Activate the address and private key to use this feature.
                </p>
            </div>
        )
    }

    return (
        <section className="relative w-full flex flex-col gap-y-4">
            {transfers.data?.length === 0
                ?
                <div className="w-full flex justify-between items-center text-sm text-stone-400">
                    <p className="">
                        Upload a CSV file for batch transfers.
                    </p>
                    <a href="/Batch_Sender_Sample.csv">
                        <Button variant="outline" className={`h-auto p-2 text-stone-600 hover:text-tangerine`}>
                            <Download />CSV Sample
                        </Button>
                    </a>
                </div>
                :
                <div className="w-full flex justify-between items-center text-sm text-stone-400">
                    <p>
                        Batch transfer list: {transfers.data?.length} transactions.
                    </p>
                </div>
            }
            {transfers.data?.length === 0 && (
                <CSVDropzone onDataParsed={(data) => { handleUpload(data); }} />
            )}
            {transfers.data && transfers.data.length > 0 && (
                <>
                    <BatchTableContainer />
                    <div className="pt-4 border-t border-tangerine/60 w-full flex justify-between gap-x-2">

                        <div className="flex items-center gap-x-2">
                            <p className="text-stone-400 text-sm">Auto Rent Energy</p>
                            <Button className={`${energyRental.enable && "hover:bg-tangerine/80 bg-tangerine/60 text-stone-50"} w-30`}
                                variant="outline" onClick={handleTriggleEnergyRental} disabled={disabled}>
                                <span className="flex items-center gap-x-1">
                                    {energyRental.enable
                                        ? <>Enabled<CheckCheck /></>
                                        : <>Disabled<X /></>
                                    }
                                </span>
                            </Button>
                        </div>

                        <div className="flex justify-between gap-x-2">
                            <Button variant="outline" className="h-auto p-2 text-stone-400 hover:text-tangerine" onClick={clearTransfers}
                                disabled={disabled}>
                                <ReplaceAll /> Clear List
                            </Button>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button className="hover:bg-tangerine/80 bg-tangerine/60 text-stone-50 flex items-center gap-x-1"
                                        disabled={disabled} onClick={handlePreview}>
                                        <span>Preview</span><SendHorizontal />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="border-tangerine/60 max-sm:w-screen max-sm:text-sm">
                                    <DialogHeader>
                                        <DialogTitle>Batch TRC20 Transfers</DialogTitle>
                                        <DialogDescription>
                                            Check all the information before confirming the transfers.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="w-full flex flex-col gap-y-4 mt-4">
                                        <div className="flex justify-between max-sm:flex-col">
                                            <span className="font-mono">Network:</span>
                                            <span className="capitalize">{network}</span>
                                        </div>
                                        <div className="flex justify-between max-sm:flex-col">
                                            <span className="font-mono">Token:</span>
                                            <span>{transfers.token}</span>
                                        </div>
                                        <div className="flex justify-between max-sm:flex-col">
                                            <span className="font-mono">Total Amount:</span>
                                            <span>{transfers.data?.reduce((acc, item) => acc + item.amount, 0) || <p className="text-red-600">N/A</p>}</span>
                                        </div>
                                        <div className="flex justify-between max-sm:flex-col">
                                            <span className="font-mono">Energy Required:</span>
                                            {isLoading
                                                ? <span><Spinner /></span>
                                                : <span>{energyRental.targetTier ?? <p className="text-red-600">N/A</p>}</span>
                                            }
                                        </div>
                                        <div className="flex justify-between max-sm:flex-col">
                                            <span className="font-mono">Auto Rent Energy:</span>
                                            <span>{energyRental.enable ? "Enabled" : "Disabled"}</span>
                                        </div>
                                    </div>
                                    <DialogFooter className="mt-4">
                                        <div className="flex w-full gap-x-2">
                                            <DialogClose asChild>
                                                <Button variant="outline" className="w-0 grow text-stone-400 hover:text-tangerine">Close</Button>
                                            </DialogClose>
                                            <DialogClose asChild>
                                                <Button className="hover:bg-tangerine/80 bg-tangerine/60 text-stone-50 w-0 grow"
                                                    onClick={transferFlow} disabled={disabled}>
                                                    Send
                                                </Button>
                                            </DialogClose>
                                        </div>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>

                    <TransferStatusContainer transferType="batch" />
                </>
            )
            }
        </section >
    )
};