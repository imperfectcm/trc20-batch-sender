"use client";

import { Button } from "../ui/button";
import { useOperationStore, useSenderStore } from "@/utils/store";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { CopyButton } from "../ui/copy-button";

export const TransferRecordsContainer = () => {
    const network = useSenderStore(state => state.network);
    const address = useSenderStore(state => state.address);
    const addressActivated = useSenderStore(state => state.active.address);

    const fetchTransferRecords = useOperationStore(state => state.fetchTransferRecords);
    const transferRecords = useOperationStore(state => state.transferRecords);
    const isLoading = useOperationStore((state) => state.isLoading);

    const handleClick = async () => {
        await fetchTransferRecords({ network, address });
    }

    return (
        <div className="w-full">
            {addressActivated ?
                <div className="w-full flex flex-col gap-y-2">
                    <p className="text-sm text-neutral-400" >
                        Check the 20 most recent TRC20 transfer records.
                    </p>
                    <div className="flex gap-x-2">
                        <Button variant="outline" onClick={handleClick} disabled={isLoading}>Check Records</Button>
                    </div>
                </div>
                :
                <p className="w-full text-center text-sm text-neutral-400" >
                    activate the address to use this feature.
                </p>
            }

            {/* TO DO: set time range filter */}
            {transferRecords.length > 0 && (
                <Table className="w-full">
                    <TableHeader>
                        <TableRow>
                            {["TxID", "From", "To", "Amount", "Time"].map((header, i) => (
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
                            <TableRow key={index} className="odd:bg-neutral-800 text-sm">
                                <TableCell className="relative px-2 py-2 w-[20%] max-w-0">
                                    <div className="truncate text-balance pr-6">{tx.transaction_id}</div>
                                    <div className="absolute top-1/2 -translate-y-1/2 right-0"><CopyButton content={tx.transaction_id} size="sm" variant="ghost" /></div>

                                </TableCell>
                                <TableCell className="px-2 py-2 break-all">{tx.from}</TableCell>
                                <TableCell className="px-2 py-2 break-all">{tx.to}</TableCell>
                                <TableCell className="px-2 py-2 whitespace-nowrap">{tx.from === address && "-"} {parseInt(tx.value) / Math.pow(10, tx.token_info.decimals)} {tx.token_info.symbol}</TableCell>
                                <TableCell className="px-2 py-2">{new Date(tx.block_timestamp).toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div >
    )
}