import type { Metadata } from "next";
import { Quicksand, Quantico } from "next/font/google";
import "./css/globals.css";
import "./css/shadow.css";

const quicksand = Quicksand({
  subsets: ['latin'],
  variable: "--font-quicksand",
  display: 'swap',
  adjustFontFallback: false,
});

const quantico = Quantico({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: "--font-quantico",
  display: 'swap',
  adjustFontFallback: false,
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
        className={`${quantico.variable} ${quicksand.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
