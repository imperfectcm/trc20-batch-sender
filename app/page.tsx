import Image from 'next/image';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center font-zalando-sans">
      <main className="flex min-h-screen w-full max-w-7xl flex-col items-center justify-between py-16 px-4 sm:items-start">
        <nav className='fixed top-0 left-0 w-full max-sm:text-center font-quantico font-bold text-xl text-tangerine tangerine-shadow select-none p-2 bg-background'>
          <Image src="/icon.png" alt="TRC20 Batch Transfer Logo" width={40} height={40} className="inline-block mr-2" />
          TRC20 Batch Transfer
        </nav>

      </main>
    </div>
  );
}
