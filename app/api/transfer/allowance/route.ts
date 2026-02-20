import { NextRequest, NextResponse } from 'next/server';
import tronService from '@/services/tronService';
import { Network } from '@/models/network';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const {
            network = "mainnet",
            fromAddress,
            token
        } = await request.json() as { network: Network, fromAddress: string, token: string };
        if (!fromAddress || !token) {
            return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
        }

        const result = await tronService.checkAllowance({ network, fromAddress, token });
        return NextResponse.json({ success: true, data: { allowance: result.allowanceStr } }, { status: 200 });
    } catch (error) {
        console.error("[API_ERROR] /transfer/allowance: ", error);
        return NextResponse.json({ success: false, message: (error as Error).message || "Internal Server Error" }, { status: 500 });
    }
}