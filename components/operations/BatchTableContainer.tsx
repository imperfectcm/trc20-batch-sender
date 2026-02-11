"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useOperationStore } from "@/utils/store";

export const BatchTableContainer = () => {
    const batchTransfers = useOperationStore(state => state.batchTransfers);

    return (
        <Table className="w-full">
            <TableHeader>
                <TableRow>
                    {["Recipient Address", "USDT Amount", "Remark"].map((header, i) => (
                        <TableHead key={header}
                            className={`${i === 0 && "w-[20%]"} ${header === "Time" && "text-right"}`}
                        >
                            {header}
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {batchTransfers.data?.map((row, index) => (
                    <TableRow key={index} className={`odd:bg-stone-700/50 text-sm text-stone-300 ${row.warning && "text-red-500"}`} >
                        <TableCell className="relative p-2 w-[50%] max-w-0">
                            <div className="truncate text-balance">{row.toAddress}</div>
                        </TableCell>
                        <TableCell className="p-2 break-all">{row.amount}</TableCell>
                        <TableCell className="p-2 whitespace-nowrap">{row.warning || "-"}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}