"use client";

import { useOperationStore, useSenderStore } from "@/utils/store";
import { Button } from "../ui/button";
import { Download, ReplaceAll, SendHorizontal } from "lucide-react";
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
    const fromAddress = useSenderStore(state => state.address);
    const privateKey = useSenderStore(state => state.privateKey);
    const network = useSenderStore(state => state.network);
    const addressActivated = useSenderStore(state => state.active.address);
    const validateAddress = useSenderStore(state => state.validateAddress);

    const energyRental = useOperationStore(state => state.energyRental);
    const transfers = useOperationStore(state => state.batchTransfers);
    const setBatchTransfers = useOperationStore(state => state.setBatchTransfers);
    const simulateTransfer = useOperationStore(state => state.simulateBatchTransfer);
    const transferFlow = useOperationStore((state) => state.batchTransferFlow);
    const resumeBatchTransferMonitoring = useOperationStore((state) => state.resumeBatchTransferMonitoring);
    const clearTransfers = useOperationStore(state => state.clearBatchTransfers);
    const isLoading = useOperationStore((state) => state.isLoading);

    const disable = isLoading || transfers.status === "pending";

    const handleUpload = async (data: { header?: string[]; data: unknown[] }) => {
        if (data.header?.join(",") !== ["Recipient_Address", "USDT"].join(",")) {
            toast.warning("CSV header is incorrect. Ensure it matches the sample format.");
            return;
        }
        if (!Array.isArray(data.data) || data.data.length === 0) {
            toast.warning("CSV file is empty or not properly formatted.");
            return;
        }

        const parsingData = Promise.all([...data.data]
            .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
            .map(async (row) => {
                if (typeof row === "object" && row !== null) {
                    const rawAddress = row["Recipient_Address"];
                    const rawAmount = row["USDT"];

                    const toAddress = String(rawAddress || "").trim();

                    const amountStr = String(rawAmount || "").replace(/,/g, "");
                    const amount = parseFloat(amountStr);

                    if (!toAddress) return null;

                    const isValidAddr = await validateAddress(toAddress);
                    const isValidAmount = !Number.isNaN(amount) && amount > 0;

                    if (!isValidAddr) {
                        return { toAddress, amount, warning: "Invalid address" };
                    }
                    if (!isValidAmount) {
                        return { toAddress, amount, warning: "Invalid amount" };
                    }

                    return { toAddress, amount };
                }
            })
            // .filter((item): item is { toAddress: string; amount: number; warning?: string } => item !== null)
        )

        const parsedData = await parsingData;
        const validData = parsedData.filter((item): item is { toAddress: string; amount: number } => !item !== null);

        setBatchTransfers({
            fromAddress,
            privateKey,
            status: 'standby',
            token: 'USDT',
            txid: undefined,
            error: undefined,
            data: validData
        });
    }

    const debouncedSimulate = useReqDebounce("simulateBatchTransfer", simulateTransfer);
    const handlePreview = async () => {
        await debouncedSimulate();
    };

    useEffect(() => {
        if (addressActivated) {
            resumeBatchTransferMonitoring();
        };
    }, [addressActivated, resumeBatchTransferMonitoring]);

    if (!addressActivated) {
        return (
            <div className="w-full flex flex-col gap-y-4">
                <p className="w-full text-center text-sm text-stone-400" >
                    Activate the address to use this feature.
                </p>
            </div>
        )
    }

    return (
        <section className="w-full flex flex-col gap-y-4">
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
                    Batch transfer list: {transfers.data?.length} transactions.
                </div>
            }
            {transfers.data?.length === 0 && (
                <CSVDropzone onDataParsed={(data) => { handleUpload(data); }} />
            )}
            {transfers.data && transfers.data.length > 0 && (
                <>
                    <BatchTableContainer />
                    <div className="w-full flex justify-end gap-x-2">
                        <Button variant="outline" className={`h-auto p-2 text-stone-400 hover:text-tangerine`} onClick={clearTransfers}
                            disabled={disable}>
                            <ReplaceAll /> Clear List
                        </Button>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button className="hover:bg-tangerine/80 bg-tangerine/60 text-stone-50 flex items-center gap-x-1"
                                    disabled={disable} onClick={handlePreview}>
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
                                                onClick={transferFlow} disabled={disable}>
                                                Send
                                            </Button>
                                        </DialogClose>
                                    </div>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <TransferStatusContainer transferType="batch" />
                </>
            )}
        </section>
    )
};