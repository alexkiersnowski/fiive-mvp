import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fiive – Client Management Software for Agencies",
  description: "Client management and client portal software for agencies to manage clients, projects, requests, and collaboration in one place.",
  viewport: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no",
  openGraph: {
    title: "Fiive – Client Management Software for Agencies",
    description: "Client management and client portal software for agencies to manage clients, projects, requests, and collaboration in one place.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Fiive – Client Management Software for Agencies",
    description: "Client management and client portal software for agencies to manage clients, projects, requests, and collaboration in one place.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
