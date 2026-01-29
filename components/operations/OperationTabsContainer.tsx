"use client";

import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { CheckAddressContainer } from "./CheckAddressContainer";
import { TransferRecordsContainer } from "./TransferRecordsContainer";

const TAB_OPTIONS = [
    { label: "Check Address", value: "check-address" },
    { label: "Check History", value: "check-history" },
] as const;

export const OperationTabsContainer = () => {
    return (
        <section className="w-full">
            <Tabs defaultValue="check-address" className="flex flex-col gap-y-4">
                <TabsList className="w-full bg-tangerine/10 ring-1 ring-tangerine/40 rounded-lg">
                    {TAB_OPTIONS.map(({ label, value }) => (
                        <TabsTrigger key={value} className="grow data-[state=active]:bg-tangerine/60" value={value}>{label}</TabsTrigger>
                    ))}
                </TabsList>
                <div className="w-full p-4 ring-1 ring-tangerine/40 rounded-lg">
                    <TabsContent value="check-address"><CheckAddressContainer /></TabsContent>
                    <TabsContent value="check-history"><TransferRecordsContainer /></TabsContent>
                </div>
            </Tabs>
        </section>
    );
}