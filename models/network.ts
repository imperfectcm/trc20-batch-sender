export type Network = 'mainnet' | 'shasta';

export const NETWORK_OPTIONS: { label: string; value: Network }[] = [
    { label: 'Mainnet', value: 'mainnet' },
    { label: 'Shasta Testnet', value: 'shasta' },
] as const;