import { NextRequest, NextResponse } from 'next/server';
import tronService from '@/services/tronService';

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const address = request.nextUrl.searchParams.get("address");
        const token = request.nextUrl.searchParams.get("token");
        if (!address || !token) {
            return NextResponse.json({ success: false, message: "Incomplete parameters" }, { status: 400 });
        }

        const payload = { address, token }
        const data = await tronService.getBalance(payload);
        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error) {
        console.error("[API_ERROR] /tron: ", error);
        return NextResponse.json({ success: false, message: (error as Error).message || "Internal Server Error" }, { status: 500 });
    }
}
