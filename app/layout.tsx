import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Distribution Shift",
  description:
    "Shift-gated test-time adaptation for traffic-sign recognition under tunnel darkness and fog.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
          {children}
        </main>
        <footer className="border-t border-line py-6 text-center text-xs text-muted">
          Developed by Group 9
        </footer>
      </body>
    </html>
  );
}
