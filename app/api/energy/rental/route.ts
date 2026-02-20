import { NextRequest, NextResponse } from 'next/server';
import tronService from '@/services/tronService';
import { Network } from '@/models/network';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const {
            network,
            address,
            energyReq,
        } = await request.json() as {
            network: Network,
            address: string,
            energyReq?: number,
        };

        if (!network || !address) {
            return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
        }

        const payload = { network, address, energyReq };
        const result = await tronService.rentEnergy(payload);
        return NextResponse.json({ success: result.success, data: result.data, message: "Energy rental successful", skip: result.skip }, { status: result.success ? 200 : 400 });
    } catch (error) {
        console.error("[API_ERROR] /energy/rental: ", error);
        return NextResponse.json({ success: false, message: (error as Error).message || "Internal Server Error" }, { status: 500 });
    }
}