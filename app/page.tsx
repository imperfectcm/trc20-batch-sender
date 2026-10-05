import { OperationTabsContainer } from "@/components/operations/OperationTabsContainer";
import { AdapterContainer } from "@/components/user-info/AdapterContainer";
import { NetworkContainer } from "@/components/user-info/NetworkContainer";
import { PrivateKeyContainer } from "@/components/user-info/PrivateKeyContainer";
import { ProfileContainer } from "@/components/user-info/ProfileContainer";
import { SenderAddressContainer } from "@/components/user-info/SenderAddressContainer";
import { UnlockProfileButton } from "@/components/user-info/UnlockProfileButton";

export default function Home() {
  return (
    <div className="master-page-view">
      <main
        className="page-view items-center sm:items-start gap-y-10"
        suppressHydrationWarning
      >
        <article className="w-full flex flex-col gap-y-4">
          <AdapterContainer />
          <SenderAddressContainer />
          <PrivateKeyContainer />
          <NetworkContainer />
          <UnlockProfileButton />
        </article>
        <ProfileContainer />
        <OperationTabsContainer />
      </main>
    </div>
  );
}
