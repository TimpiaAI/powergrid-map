import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PowerGrid AI",
  description:
    "Professional power grid visualization and analysis tool for Romanian electrical infrastructure engineers",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full bg-background text-foreground font-sans overflow-hidden">
        {children}
      </body>
    </html>
  );
}
