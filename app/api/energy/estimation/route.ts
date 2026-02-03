import { NextRequest, NextResponse } from 'next/server';
import tronService from '@/services/tronService';
import { Network } from '@/models/network';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const {
            network,
            fromAddress,
            toAddress,
            token,
            amount
        } = await request.json() as {
            network: Network,
            fromAddress: string,
            toAddress: string,
            token: string,
            amount: number
        };

        if (!network || !fromAddress || !toAddress || !token || !amount) {
            return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
        }

        const payload = { network, fromAddress, toAddress, token, amount };
        const data = await tronService.estimateEnergy(payload);
        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        console.error("[API_ERROR] /energy/estimation: ", error);
        return NextResponse.json({ success: false, message: (error as Error).message || "Internal Server Error" }, { status: 500 });
    }
}