export type Network = 'mainnet' | 'shasta';

export const NETWORK_OPTIONS: { label: string; value: Network }[] = [
    { label: 'Mainnet', value: 'mainnet' },
    { label: 'Shasta Testnet', value: 'shasta' },
] as const;

export const API_ENDPOINTS = {
    mainnet: 'https://api.trongrid.io',
    shasta: 'https://api.shasta.trongrid.io',
    tronscan_mainnet: "https://apilist.tronscanapi.com",
    tronscan_shasta: "https://shastapi.tronscan.org",
} as const;