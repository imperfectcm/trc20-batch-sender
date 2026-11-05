"use client";

import {
    BackpackAdapter, BinanceWalletAdapter, BitKeepAdapter, BybitWalletAdapter,
    GateWalletAdapter, GuardaAdapter, MetaMaskAdapter, OkxWalletAdapter,
    OneKeyAdapter, TokenPocketAdapter, TronLinkAdapter, TrustAdapter,
} from '@tronweb3/tronwallet-adapters';
import { WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import { useEffect, useState } from 'react';
import { type Adapter, WalletReadyState } from '@tronweb3/tronwallet-abstract-adapter';
import { WalletButtons } from './WalletButtons';

export const AdapterContainer = () => {
    const [availableAdapters, setAvailableAdapters] = useState<Adapter[]>([]);

    useEffect(() => {
        const adapters: Adapter[] = [
            new TronLinkAdapter(),
            new OkxWalletAdapter(),
            new BitKeepAdapter(),
            new TrustAdapter(),
            new TokenPocketAdapter(),
            new MetaMaskAdapter(),
            new BinanceWalletAdapter(),
            new BybitWalletAdapter(),
            new GateWalletAdapter(),
            new OneKeyAdapter(),
            new BackpackAdapter(),
            new GuardaAdapter(),
        ];
        const updateAvailableAdapters = () => {
            setAvailableAdapters(adapters.filter(adapter => adapter.readyState === WalletReadyState.Found));
        };
        adapters.forEach(adapter => { adapter.on('readyStateChanged', updateAvailableAdapters); });
        updateAvailableAdapters();
        return () => {
            adapters.forEach(adapter => { adapter.off('readyStateChanged', updateAvailableAdapters); });
        };
    }, []);

    return (
        <WalletProvider adapters={availableAdapters} autoConnect={false} disableAutoConnectOnLoad={true}>
            <WalletButtons />
        </WalletProvider>
    );
}
