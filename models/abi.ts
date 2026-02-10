export const balanceAbi = [
    {
        'name': 'balanceOf',
        'constant': true,
        'outputs': [{ 'type': 'uint256' }],
        'inputs': [{ 'name': 'who', 'type': 'address' }],
        'stateMutability': 'View',
        'type': 'Function'
    },
    {
        'name': 'transfer',
        'outputs': [{ 'type': 'bool' }],
        'inputs': [
            { 'name': '_to', 'type': 'address' },
            { 'name': '_value', 'type': 'uint256' }
        ],
        'stateMutability': 'Nonpayable',
        'type': 'Function'
    }
];

export const batchSenderAbi = [
    {
        "inputs": [
            { "internalType": "address", "name": "_token", "type": "address" },
            { "internalType": "address[]", "name": "_recipients", "type": "address[]" },
            { "internalType": "uint256[]", "name": "_amounts", "type": "uint256[]" }
        ],
        "name": "multisendToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]