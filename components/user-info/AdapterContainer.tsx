"use client";

import { TronLinkAdapter } from '@tronweb3/tronwallet-adapters';
import { WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { WalletReadyState } from '@tronweb3/tronwallet-abstract-adapter';
import { WalletButtons } from './WalletButtons';

export const AdapterContainer = () => {
    const [readyState, setReadyState] = useState(WalletReadyState.NotFound);

    const adapters = useMemo(() => [
        new TronLinkAdapter({ checkTimeout: 3000 }),
    ], []);

    useEffect(() => {
        // console.log("adapters[0].readyState", adapters[0].readyState);
        setReadyState(adapters[0].readyState);
    }, [adapters]);

    console.log("AdapterContainer render, readyState:", readyState);
    return (
        <WalletProvider adapters={adapters} disableAutoConnectOnLoad={true}>
            <WalletButtons readyState={readyState} />
        </WalletProvider>
    );
}