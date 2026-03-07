import type { Metadata } from "next";
import { Saira } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const saira = Saira({
  subsets: ['latin'],
  variable: '--font-sans'
})

export const metadata: Metadata = {
  title: "QueryNest",
  description: "A multi-agent AI research assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${saira.className} antialiased`}
      >
        {children}
        <Toaster
          position="top-right"
          duration={5000}
          richColors
          closeButton
          theme="dark"
        />
      </body>
    </html>
  );
}
