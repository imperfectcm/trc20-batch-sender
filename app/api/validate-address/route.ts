import { NextRequest, NextResponse } from 'next/server';
import tronService from '@/services/tronService';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const { address } = await request.json() as { address: string };
        if (!address) {
            return NextResponse.json({ success: false, message: "No address provided" }, { status: 400 });
        }

        const data = await tronService.validateAddress(address);
        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        console.error("[API_ERROR] /tron: ", error);
        return NextResponse.json({ success: false, message: (error as Error).message || "Internal Server Error" }, { status: 500 });
    }
}