"use client";

import { useOperationStore, useSenderStore } from "@/utils/store";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ALLOWED_TOKENS } from "@/models/transfer";
import { Input } from "../ui/input";
import { toast } from "sonner";
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
import { CheckCheck, SendHorizontal, X } from "lucide-react";
import { TransferStatusContainer } from "./TransferStatusContainer";
import { Spinner } from "../ui/spinner";
import { useReqDebounce } from "@/hooks/useReqDebounce";
import { useEffect } from "react";

export const SingleTransferContainer = () => {
    const network = useSenderStore(state => state.network);
    const addressActivated = useSenderStore(state => state.active.address);

    const transferToken = useOperationStore(state => state.transferToken);
    const setTransferToken = useOperationStore(state => state.setTransferToken);
    const energyRental = useOperationStore(state => state.energyRental);
    const setEnergyRental = useOperationStore(state => state.setEnergyRental);
    const transferData = useOperationStore(state => state.singleTransferData);
    const updateTransfer = useOperationStore(state => state.updateSingleTransfer);
    const simulateTransfer = useOperationStore(state => state.simulateSingleTransfer);
    const transferFlow = useOperationStore((state) => state.singleTransferFlow);
    const resumeTransferMonitoring = useOperationStore((state) => state.resumeTransferMonitoring);
    const isLoading = useOperationStore((state) => state.isLoading);

    const disable = isLoading || transferData.status === "pending";

    const handleTriggleEnergyRental = () => {
        setEnergyRental({ ...energyRental, enable: !energyRental.enable });
    }

    const handleToAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        updateTransfer({ "toAddress": value });
    }

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const amount = parseFloat(value);
        if (isNaN(amount) || amount <= 0) {
            toast.warning("Enter a valid amount.");
            updateTransfer({ "amount": 0 });
            return;
        }
        updateTransfer({ "amount": amount });
    }

    const debouncedSimulate = useReqDebounce("simulateTransfer", simulateTransfer);
    const handlePreview = async () => {
        await debouncedSimulate();
    };

    useEffect(() => {
        if (addressActivated) {
            resumeTransferMonitoring();
        };
    }, [addressActivated, resumeTransferMonitoring]);

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
            <div className="w-full flex justify-between gap-y-2 text-sm text-stone-400">
                <p>
                    Create a single TRX / USDT transaction in TRC20 network.
                </p>
                <p>
                    Network: <span className="capitalize">{network}</span>
                </p>
            </div>

            <div className="w-full flex flex-col gap-y-2">
                {/* Chooses token and auto energy rental */}
                <div className="flex gap-x-2">
                    <div className="basis-2/3">
                        <Label>Token</Label>
                        <Select value={transferToken} onValueChange={setTransferToken} disabled={disable}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Token" />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from(ALLOWED_TOKENS).map((option) => (
                                    <SelectItem
                                        key={option}
                                        value={option}
                                        onSelect={() => setTransferToken(option)}
                                    >
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="basis-1/3">
                        <Label>Auto Rent Energy</Label>
                        <Button className={`${energyRental.enable && "hover:bg-tangerine/80 bg-tangerine/60 text-stone-50"} w-full`}
                            variant="outline" onClick={handleTriggleEnergyRental} disabled={disable}>
                            <span className="flex items-center gap-x-1">
                                {energyRental.enable
                                    ? <>Enabled<CheckCheck /></>
                                    : <>Disabled<X /></>
                                }
                            </span>
                        </Button>
                    </div>
                </div>
                {/* The receiver address */}
                <div>
                    <Label>Receiver Address</Label>
                    <Input disabled={disable} onChange={handleToAddressChange} value={transferData.toAddress} />
                </div>
                {/* The transfer amount and send button*/}
                <div className="flex gap-x-2">
                    <div className="basis-2/3">
                        <Label>Amount</Label>
                        <Input disabled={disable} onChange={handleAmountChange} value={transferData.amount} />
                    </div>
                    <div className="mt-auto basis-1/3">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button className="hover:bg-tangerine/80 bg-tangerine/60 text-stone-50 w-full flex items-center gap-x-1"
                                    disabled={disable} onClick={handlePreview}>
                                    <span>Preview</span><SendHorizontal />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="border-tangerine/60 max-sm:w-screen max-sm:text-sm">
                                <DialogHeader>
                                    <DialogTitle>Single TRC20 Transfer</DialogTitle>
                                    <DialogDescription>
                                        Check all the information before confirming the transfer.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="w-full flex flex-col gap-y-4 mt-4">
                                    <div className="flex justify-between max-sm:flex-col">
                                        <span className="font-mono">Network:</span>
                                        <span className="capitalize">{network}</span>
                                    </div>
                                    <div className="flex justify-between max-sm:flex-col">
                                        <span className="font-mono">Token:</span>
                                        <span>{transferToken}</span>
                                    </div>
                                    <div className="flex justify-between max-sm:flex-col overflow-hidden">
                                        <span className="font-mono">Recipient:</span>
                                        <span className="break-all">{transferData.toAddress || <p className="text-red-600">N/A</p>}</span>
                                    </div>
                                    <div className="flex justify-between max-sm:flex-col">
                                        <span className="font-mono">Amount:</span>
                                        <span>{transferData.amount || <p className="text-red-600">N/A</p>}</span>
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
                </div>
            </div>

            <TransferStatusContainer transferType="single" />
        </section>
    );
}