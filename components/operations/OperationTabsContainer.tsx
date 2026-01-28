"use client";

import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { CheckAddressContainer } from "./CheckAddressContainer";
import { TransferRecordsContainer } from "./TransferRecordsContainer";

export const OperationTabsContainer = () => {
    return (
        <section className="w-full">
            <Tabs defaultValue="check-address" className="flex flex-col gap-y-4">
                <TabsList className="w-full bg-tangerine/40 rounded-lg">
                    <TabsTrigger className="grow" value="check-address">Check Address</TabsTrigger>
                    <TabsTrigger className="grow" value="check-history">Check History</TabsTrigger>
                </TabsList>
                <div className="w-full p-4 ring-1 ring-tangerine/40 rounded-lg">
                    <TabsContent value="check-address"><CheckAddressContainer /></TabsContent>
                    <TabsContent value="check-history"><TransferRecordsContainer /></TabsContent>
                </div>
            </Tabs>
        </section>
    );
}