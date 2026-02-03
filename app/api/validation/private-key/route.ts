import { NextRequest, NextResponse } from 'next/server';
import tronService from '@/services/tronService';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const { addressActivated, address, privateKey } = await request.json() as { addressActivated: boolean, address: string, privateKey: string };
        if (!address || !addressActivated) {
            return NextResponse.json({ success: false, message: "No address provided" }, { status: 400 });
        }
        if (!privateKey) {
            return NextResponse.json({ success: false, message: "No private key provided" }, { status: 400 });
        }

        const payload = { address, privateKey };
        const data = await tronService.validatePrivateKey(payload);
        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        console.error("[API_ERROR] /validate-private-key: ", error);
        return NextResponse.json({ success: false, message: (error as Error).message || "Internal Server Error" }, { status: 500 });
    }
}