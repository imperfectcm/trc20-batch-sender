import { SenderAddressContainer } from "@/components/user-info/SenderAddressContainer";
import { PrivateKeyContainer } from "@/components/user-info/PrivateKeyContainer";
import { NetworkContainer } from "@/components/user-info/NetworkContainer";
import { UnlockProfileButton } from "@/components/user-info/UnlockProfileButton";
import { ProfileContainer } from "@/components/user-info/ProfileContainer";
import { OperationTabsContainer } from "@/components/operations/OperationTabsContainer";

export default function Home() {
  return (
    <div className="master-page-view">
      <main className="page-view items-center sm:items-start gap-y-10">
        <article className="w-full flex flex-col gap-y-4">
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