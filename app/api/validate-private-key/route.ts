import { NextRequest, NextResponse } from 'next/server';
import tronService from '@/services/tronService';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const { privateKey } = await request.json() as { privateKey: string };
        if (!privateKey) {
            return NextResponse.json({ success: false, message: "No private key provided" }, { status: 400 });
        }

        const data = await tronService.validatePrivateKey(privateKey);
        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        console.error("[API_ERROR] /validate-private-key: ", error);
        return NextResponse.json({ success: false, message: (error as Error).message || "Internal Server Error" }, { status: 500 });
    }
}