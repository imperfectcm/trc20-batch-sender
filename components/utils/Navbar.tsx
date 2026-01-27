import Image from 'next/image';

export const Navbar = () => {
    return (
        <nav className='fixed top-0 left-0 w-full flex max-sm:justify-center p-2 bg-background'>
            <div className='font-quantico font-bold text-xl text-tangerine tangerine-shadow select-none'>
                <Image src="/icon.png" alt="TRC20 Batch Transfer Logo" width={40} height={40} className="inline-block mr-2" />
                TRC20 Batch Transferer
            </div>
        </nav>
    );
}