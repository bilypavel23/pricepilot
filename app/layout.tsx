import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "PricePilot",
  description: "Price monitoring and optimization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className="h-full overflow-hidden bg-slate-50 text-slate-900 antialiased dark:bg-[#0c0e16] dark:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

