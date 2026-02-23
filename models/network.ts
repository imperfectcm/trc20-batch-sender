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

export const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";