import type { Metadata } from "next";
import { Quicksand, Quantico } from "next/font/google";
import "./globals.css";
import "../css/pageView.css";
import "../css/shadows.css";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/utils/Navbar";

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
  title: "TRC20 Batch Sender",
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
        <Navbar />
        <Toaster richColors position="bottom-center" />
      </body>
    </html>
  );
}
