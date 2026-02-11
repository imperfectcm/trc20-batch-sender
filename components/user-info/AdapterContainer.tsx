"use client";

import { TronLinkAdapter, TronLinkAdapterName } from '@tronweb3/tronwallet-adapters';
import { useWallet, WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import { Button } from '../ui/button';
import { useEffect, useMemo, useState } from 'react';
import { useSenderStore } from '@/utils/store';
import { toast } from 'sonner';
import { WalletReadyState } from '@tronweb3/tronwallet-abstract-adapter';

const WalletButtons = ({ readyState }: { readyState: WalletReadyState }) => {
    const connectAdapter = useSenderStore(state => state.connectAdapter);
    const disconnectAdapter = useSenderStore(state => state.disconnectAdapter);

    const { wallet, connect, disconnect, select, connected, wallets } = useWallet();
    function onSelect() {
        select(TronLinkAdapterName);
    }
    async function onConnect() {
        try {
            await connect();
        } catch (error) {
            toast.warning((error as Error).message || "Failed to connect wallet");
        }
    }

    useEffect(() => {
        if (connected && wallet?.adapter.address) {
            connectAdapter(wallet.adapter);
        } else {
            disconnectAdapter();
        }
    }, [connected, wallet?.adapter.address]);

    if (readyState !== WalletReadyState.Found) {
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
                <p className='font-mono text-stone-500'>Connected: {wallet?.adapter.name}</p>
            }

            {!connected ? (
                <Button variant="outline" className='h-auto p-2 text-stone-400 hover:text-tangerine'
                    onClick={onConnect}>
                    Connect {wallet?.adapter.name || 'Wallet'}
                </Button>
            ) : (
                <Button variant="outline" className='h-auto p-2 text-stone-400 hover:text-tangerine'
                    onClick={disconnect}>
                    Disconnect
                </Button>
            )}
        </div>
    );
}

export const AdapterContainer = () => {
    const [readyState, setReadyState] = useState(WalletReadyState.NotFound);

    const adapters = useMemo(() => [
        new TronLinkAdapter({ checkTimeout: 3000 }),
    ], []);

    useEffect(() => {
        setReadyState(adapters[0].readyState);
    }, [adapters]);

    return (
        <WalletProvider adapters={adapters}>
            <WalletButtons readyState={readyState} />
        </WalletProvider>
    );
}