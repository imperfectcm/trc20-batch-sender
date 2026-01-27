import { SenderAddressContainer } from "@/components/user-info/SenderAddressContainer";
import { PrivateKeyContainer } from "@/components/user-info/PrivateKeyContainer";
import { UnlockProfileButton } from "@/components/user-info/UnlockProfileButton";
import { ProfileContainer } from "@/components/user-info/ProfileContainer";

export default function Home() {
  return (
    <div className="master-page-view">
      <main className="page-view items-center sm:items-start">
        <article className="w-full flex flex-col gap-y-4">
          <SenderAddressContainer />
          <PrivateKeyContainer />
          <UnlockProfileButton />
          <ProfileContainer />
        </article>
      </main>
    </div>
  );
}