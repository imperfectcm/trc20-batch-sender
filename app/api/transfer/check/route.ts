import { NextRequest, NextResponse } from 'next/server';
import tronService from '@/services/tronService';
import { Network } from '@/models/network';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const { network, txID, token } = await request.json() as { network?: Network, txID: string, token: string };
        if (!txID) {
            return NextResponse.json({ success: false, message: "No transaction ID provided" }, { status: 400 });
        }

        const data = await tronService.checkTransaction({ network, txID, token });
        return NextResponse.json({ success: true, data: data }, { status: 200 });
    } catch (error) {
        console.error("[API_ERROR] /transfer/check: ", error);
        return NextResponse.json({ success: false, message: (error as Error).message || "Internal Server Error" }, { status: 500 });
    }
}