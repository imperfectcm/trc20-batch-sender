import { NextRequest, NextResponse } from 'next/server';
import tronService from '@/services/tronService';
import { Network } from '@/models/network';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const {
            network = "mainnet",
            fromAddress,
            token,
            amount
        } = await request.json() as { network: Network, fromAddress: string, token: string, amount: string };
        if (!fromAddress || !token || !amount) {
            return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
        }

        const result = await tronService.buildApprovement({ network, fromAddress, token, amount });
        return NextResponse.json({ success: true, data: { unsignedTx: result.unsignedTx } }, { status: 200 });
    } catch (error) {
        console.error("[API_ERROR] /transfer/approvement: ", error);
        return NextResponse.json({ success: false, message: (error as Error).message || "Internal Server Error" }, { status: 500 });
    }
}