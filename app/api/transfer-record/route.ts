import { NextRequest, NextResponse } from 'next/server';
import tronService from '@/services/tronService';
import { Network } from '@/models/network';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const { network = "mainnet", address } = await request.json() as { network: Network, address: string };
        if (!address) {
            return NextResponse.json({ success: false, message: "No address provided" }, { status: 400 });
        }

        const data = await tronService.getRecentTransfers({ network, address });
        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        console.error("[API_ERROR] /transfer-record: ", error);
        return NextResponse.json({ success: false, message: (error as Error).message || "Internal Server Error" }, { status: 500 });
    }
}