import { NextRequest, NextResponse } from 'next/server';
import tronService from '@/services/tronService';
import { Network } from '@/models/network';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const {
            network = "mainnet",
            fromAddress,
            privateKey,
            token = 'USDT',
            recipients,
            simulateOnly = false
        } = await request.json() as { network: Network, fromAddress: string, privateKey: string, token: string, recipients: { toAddress: string, amount: number }[], simulateOnly: boolean };
        if (!privateKey || !fromAddress || recipients.length === 0) {
            return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
        }

        const result = await tronService.batchTransfer({ network, privateKey, fromAddress, token, recipients, simulateOnly });
        return NextResponse.json({ success: result.success, data: { data: result.data, timeout: result.timeout } }, { status: result.success ? 200 : 400 });
    } catch (error) {
        console.error("[API_ERROR] /transfer/batch: ", error);
        return NextResponse.json({ success: false, message: (error as Error).message || "Internal Server Error" }, { status: 500 });
    }
}