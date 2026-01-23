import type { Metadata } from "next";
import { Zalando_Sans, Stack_Sans_Notch } from "next/font/google";
import "./globals.css";

const zalandoSans = Zalando_Sans({
  variable: "--font-zalando-sans",
  subsets: ['latin'],
});

const stackSansNotch = Stack_Sans_Notch({
  variable: "--font-stack-sans-notch",
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: "TRC20 Batch Transfer",
  description: "A SaaS platform for batch TRX and USDT transactions using the TRC20 token standard on the TRON blockchain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${stackSansNotch.variable} ${zalandoSans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
