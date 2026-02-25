"use client";

import { TronLinkAdapter } from '@tronweb3/tronwallet-adapters';
import { WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { WalletReadyState } from '@tronweb3/tronwallet-abstract-adapter';
import { WalletButtons } from './WalletButtons';

export const AdapterContainer = () => {
    const [readyState, setReadyState] = useState(WalletReadyState.NotFound);
    const adapter = useMemo(() => new TronLinkAdapter(), []);

    useEffect(() => {
        setReadyState(adapter.readyState);
        adapter.on('readyStateChanged', (state) => {
            setReadyState(state);
        });
        return () => {
            adapter.removeAllListeners();
        };
    }, []);

    return (
        <WalletProvider adapters={[adapter]} disableAutoConnectOnLoad={true}>
            <WalletButtons readyState={readyState} />
        </WalletProvider>
    );
}