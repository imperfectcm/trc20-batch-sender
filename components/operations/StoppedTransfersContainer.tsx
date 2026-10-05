"use client";

import { useOperationStore } from "@/utils/store";
import { Button } from "../ui/button";
import { CopyButton } from "../ui/copy-button";

export const StoppedTransfersContainer = () => {
    const records = useOperationStore(state => state.stoppedTransfers);
    const removeStoppedTransfer = useOperationStore(state => state.removeStoppedTransfer);
    if (!records.length) return null;

    return (
        <details className="mt-4 rounded-lg ring-1 ring-tangerine/40 p-4 text-stone-300">
            <summary className="cursor-pointer font-medium">Stopped Tracking ({records.length})</summary>
            <p className="mt-3 text-sm text-amber-300">
                These transactions may still succeed. Check their Txids before sending again.
            </p>
            <div className="mt-3 flex flex-col gap-3">
                {records.map((record, index) => (
                    <section key={`${record.txid}-${record.stoppedAt}-${index}`} className="rounded-lg bg-stone-800 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                            <p className="capitalize">{record.type} {record.phase} · {record.network} · {new Date(record.stoppedAt).toLocaleString()}</p>
                            <Button type="button" size="sm" variant="ghost" className="shrink-0 text-red-400" onClick={() => removeStoppedTransfer(index)}>
                                Delete Record
                            </Button>
                        </div>
                        {record.fromAddress && <p className="mt-1 break-all">Sender: {record.fromAddress}</p>}
                        <div className="mt-1 flex items-center gap-1">
                            <span>Txid:</span>
                            <span className="min-w-0 break-all text-tangerine">{record.txid}</span>
                            <CopyButton content={record.txid} size="sm" variant="ghost" aria-label="Copy Txid" />
                        </div>
                        <p className="mt-2 text-stone-400">Recipients</p>
                        {record.recipients.map((recipient, recipientIndex) => (
                            <div key={recipientIndex} className="flex flex-wrap justify-between gap-x-2">
                                <span className="break-all">{recipient.toAddress}</span>
                                <span>{recipient.amount} {record.token}</span>
                            </div>
                        ))}
                    </section>
                ))}
            </div>
        </details>
    );
};
