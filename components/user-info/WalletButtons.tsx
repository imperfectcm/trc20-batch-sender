"use client";

import { TronLinkAdapter, TronLinkAdapterName } from '@tronweb3/tronwallet-adapters';
import { useWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import { Button } from '../ui/button';
import { useEffect } from 'react';
import { useOperationStore, useSenderStore } from '@/utils/store';
import { toast } from 'sonner';
import { WalletReadyState } from '@tronweb3/tronwallet-abstract-adapter';
import { Unplug } from 'lucide-react';

export const WalletButtons = ({ readyState }: { readyState?: WalletReadyState }) => {
    // console.log("WalletButtons render, readyState:", readyState);
    const addressActivated = useSenderStore((state) => state.active.address);
    const connectAdapter = useSenderStore(state => state.connectAdapter);
    const disconnectAdapter = useSenderStore(state => state.disconnectAdapter);

    const operationLoading = useOperationStore((state) => state.isLoading);
    const isTransferActive = useOperationStore((state) => state.isTransferActive);
    const disabled = operationLoading || isTransferActive("single") || isTransferActive("batch");

    const { wallet, connect, disconnect, select, connected, wallets } = useWallet();
    function onSelect() {
        select(TronLinkAdapterName);
    }
    const onConnect = async () => {
        try {
            await connect();
        } catch (error) {
            toast.warning((error as Error).message || "Failed to connect wallet");
        }
    }

    useEffect(() => {
        if (connected && wallet) {
            connectAdapter(wallet.adapter as TronLinkAdapter);
        }
    }, [connected, wallet]);

    const onDisconnect = () => {
        disconnect();
        disconnectAdapter();
    }

    if (readyState === WalletReadyState.NotFound || (!connected && addressActivated)) {
        return null;
    }
    return (
        <div className="text-sm space-y-2">
            {!connected
                ?
                <div className="flex gap-x-2">
                    {wallets.map((w) => (
                        <Button
                            key={w.adapter.name}
                            variant="outline"
                            className='h-auto p-2 text-stone-400 hover:text-tangerine'
                            onClick={onSelect}
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
                    disabled={disabled}
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
