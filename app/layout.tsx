import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { validateRequiredEnv } from "@/lib/env";
import "./globals.css";

validateRequiredEnv();

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "ConsultantPlatform",
  description: "Psychosocial consultation evidence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
