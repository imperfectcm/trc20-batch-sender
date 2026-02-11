"use client";

import { Button } from "../ui/button";
import { useOperationStore, useSenderStore } from "@/utils/store";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { CopyButton } from "../ui/copy-button";
import { Spinner } from "@/components/ui/spinner";
import { useReqDebounce } from "@/hooks/useReqDebounce";

export const TransferRecordsContainer = () => {
    const network = useSenderStore(state => state.network);
    const address = useSenderStore(state => state.address);
    const addressActivated = useSenderStore(state => state.active.address);

    const fetchTransferRecords = useOperationStore(state => state.fetchTransferRecords);
    const transferRecords = useOperationStore(state => state.transferRecords);
    const clearTransferRecords = useOperationStore(state => state.clearTransferRecords);
    const isLoading = useOperationStore((state) => state.isLoading);

    const debouncedFetch = useReqDebounce("transferRecords", fetchTransferRecords);

    const handleClick = async () => {
        await debouncedFetch({ network, address });
    }

    return (
        <section className="w-full flex flex-col gap-y-4">
            {addressActivated ?
                <div className="w-full flex flex-col gap-y-4">
                    <p className="text-sm text-stone-400" >
                        Check the most recent confirmed TRC20 transaction records.
                    </p>
                    <div className="flex gap-x-2">
                        <Button variant="outline" className="h-auto p-2 text-stone-400 hover:text-tangerine"
                            onClick={handleClick} disabled={isLoading || transferRecords.length > 0}>Check Records</Button>
                    </div>
                </div>
                :
                <p className="w-full text-center text-sm text-stone-400">
                    Activate the address to use this feature.
                </p>
            }

            {/* TO DO: set time range filter */}
            {addressActivated && transferRecords.length > 0 && !isLoading && (
                <>
                    <Table className="w-full">
                        <TableHeader>
                            <TableRow>
                                {["Txid", "From", "To", "Amount", "Time"].map((header, i) => (
                                    <TableHead key={header}
                                        className={`${i === 0 && "w-[20%]"} ${header === "Time" && "text-right"}`}
                                    >
                                        {header}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transferRecords.map((tx, index) => (
                                <TableRow key={index} className="odd:bg-stone-700/50 text-sm text-stone-300">
                                    <TableCell className="relative p-2 w-[20%] max-w-0">
                                        <div className="truncate text-balance pr-4">{tx.transaction_id}</div>
                                        <div className="absolute top-1/2 -translate-y-1/2 right-0"><CopyButton content={tx.transaction_id} size="sm" variant="ghost" /></div>
                                    </TableCell>
                                    <TableCell className="p-2 break-all">{tx.from}</TableCell>
                                    <TableCell className="p-2 break-all">{tx.to}</TableCell>
                                    <TableCell className="p-2 whitespace-nowrap">{tx.from === address && "-"} {parseInt(tx.value) / Math.pow(10, tx.token_info.decimals)} {tx.token_info.symbol}</TableCell>
                                    <TableCell className="p-2 text-right">{new Date(tx.block_timestamp).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <aside className="w-full text-center mt-4">
                        <Button variant="outline"
                            disabled={isLoading}
                            className="bg-transparent text-stone-400 hover:text-tangerine"
                            onClick={clearTransferRecords}>
                            Clear Result
                        </Button>
                    </aside>
                </>
            )}
            {addressActivated && isLoading && (
                <p className="w-full flex justify-center text-stone-400 py-8" >
                    <Spinner />
                </p>
            )}
        </section>
    )
}