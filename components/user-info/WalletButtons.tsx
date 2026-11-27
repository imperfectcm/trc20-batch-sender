"use client";

import { useWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import { Button } from '../ui/button';
import { useEffect } from 'react';
import { useOperationStore, useSenderStore } from '@/utils/store';
import { toast } from 'sonner';
import { Unplug } from 'lucide-react';

export const WalletButtons = () => {
    const addressActivated = useSenderStore((state) => state.active.address);
    const connectAdapter = useSenderStore(state => state.connectAdapter);
    const disconnectAdapter = useSenderStore(state => state.disconnectAdapter);

    const operationLoading = useOperationStore((state) => state.isLoading);
    const isTransferActive = useOperationStore((state) => state.isTransferActive);
    const { wallet, address, connect, disconnect, select, connected, connecting, disconnecting, wallets } = useWallet();
    const adapter = wallet?.adapter;
    const disabled = operationLoading || isTransferActive("single") || isTransferActive("batch") || connecting || disconnecting;

    const onConnect = async () => {
        try {
            await connect();
        } catch (error) {
            toast.warning((error as Error).message || "Failed to connect wallet");
        }
    }

    useEffect(() => {
        if (connected && adapter && address) {
            connectAdapter(adapter);
        } else if (useSenderStore.getState().adapter) {
            disconnectAdapter();
        }
    }, [connected, adapter, address, connectAdapter, disconnectAdapter]);

    const onDisconnect = async () => {
        try {
            await disconnect();
            disconnectAdapter();
        } catch (error) {
            toast.warning((error as Error).message || "Failed to disconnect wallet");
        }
    }

    if (wallets.length === 0 || (!connected && addressActivated)) {
        return null;
    }
    return (
        <div className="text-sm space-y-2">
            {!connected
                ?
                <div className="flex flex-wrap gap-2">
                    {wallets.map((w) => (
                        <Button
                            key={w.adapter.name}
                            variant={adapter === w.adapter ? "secondary" : "outline"}
                            className='h-auto p-2 text-stone-400 hover:text-tangerine'
                            onClick={() => select(w.adapter.name)}
                            disabled={disabled}
                            aria-pressed={adapter === w.adapter}
                        >
                            {w.adapter.name}
                        </Button>
                    ))}
                </div>
                :
                <p className='font-mono text-stone-500'>Connected: {wallet ? wallet.adapter.name : 'Manual Config'}</p>
            }

            {!connected
                ?
                <Button variant="outline" className='h-auto p-2 text-stone-400 hover:text-tangerine'
                    onClick={onConnect}
                    disabled={disabled || !wallet}
                >
                    Connect {wallet?.adapter.name || 'Wallet'}
                </Button>
                :
                <Button variant="outline" className='h-auto p-2 text-stone-400 hover:text-tangerine'
                    onClick={onDisconnect}
                    disabled={disabled}
                >
                    <Unplug /> Disconnect
                </Button>
            }
        </div>
    );
}
