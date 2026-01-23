import { NextRequest, NextResponse } from 'next/server';
import tronService from '@/app/services/tronService';

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const address = request.nextUrl.searchParams.get('address');
        if (!address) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        const balance = await tronService.getBalance(address);
        return NextResponse.json({ data: balance }, { status: 200 });
    } catch (error) {
        console.error("[API_ERROR] /tron: ", error);
        return NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
    }
}
