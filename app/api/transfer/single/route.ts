import { NextRequest, NextResponse } from 'next/server';
import tronService from '@/services/tronService';
import { Network } from '@/models/network';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const {
            network = "mainnet",
            fromAddress,
            toAddress,
            privateKey,
            token,
            amount
        } = await request.json() as { network: Network, fromAddress: string, toAddress: string, privateKey: string, token: string, amount: number };
        if (!privateKey || !fromAddress || !toAddress || !token || !amount) {
            return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
        }

        const data = await tronService.singleTransfer({ network, privateKey, fromAddress, toAddress, token, amount });
        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        console.error("[API_ERROR] /transfer/single: ", error);
        return NextResponse.json({ success: false, message: (error as Error).message || "Internal Server Error" }, { status: 500 });
    }
}