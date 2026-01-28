import { Network } from '@/models/network';
import tronService from '@/services/tronService';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const { network, address } = await request.json() as { network: Network, address: string };
        if (!network || !address) {
            return NextResponse.json({ success: false, message: "Incomplete parameters" }, { status: 400 });
        }

        const payload = { network, address };
        const data = await tronService.getSenderProfile(payload);
        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        console.error("[API_ERROR] /profile: ", error);
        return NextResponse.json({ success: false, message: (error as Error).message || "Internal Server Error" }, { status: 500 });
    }
}